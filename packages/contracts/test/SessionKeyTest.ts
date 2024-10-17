import { assert, expect } from "chai";
import { parseEther, randomBytes } from "ethers";
import { ethers, Wallet, ZeroAddress } from "ethers";
import { it } from "mocha";
import { SmartAccount, utils } from "zksync-ethers";

import { ERC7579Account__factory } from "../typechain-types";
import { NewSessionStruct } from "../typechain-types/src/validators/SessionKeyValidator";
import { ContractFixtures } from "./EndToEndSpendLimit";
import { getProvider } from "./utils";

describe.only("SessionKeyModule tests", function () {
  const fixtures = new ContractFixtures();
  const abiCoder = new ethers.AbiCoder();
  const provider = getProvider();
  let proxyAccountAddress: string;
  let sessionOwner: Wallet;
  let sessionTarget: string;

  async function aaTxTemplate() {
    return {
      type: 113,
      from: proxyAccountAddress,
      data: "0x",
      value: 0,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(proxyAccountAddress),
      gasPrice: await provider.getGasPrice(),
      customData: { gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT },
      gasLimit: 0n,
    };
  }

  it("should deploy implemention, proxy and session key module", async () => {
    const accountImplContract = await fixtures.getAccountImplContract();
    assert(accountImplContract != null, "No account impl deployed");
    const proxyAccountContract = await fixtures.getProxyAccountContract();
    assert(proxyAccountContract != null, "No account proxy deployed");
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    assert(sessionKeyModuleContract != null, "No session key module deployed");
  });


  it("should deploy proxy account via factory", async () => {
    const aaFactoryContract = await fixtures.getAaFactory();
    assert(aaFactoryContract != null, "No AA Factory deployed");

    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const sessionKeyModuleAddress = await sessionKeyModuleContract.getAddress();

    const sessionKeyPayload = abiCoder.encode(["address", "bytes"], [sessionKeyModuleAddress, "0x"]);

    const deployTx = await aaFactoryContract.deployProxy7579Account(
      randomBytes(32),
      await fixtures.getAccountImplAddress(),
      "id",
      [],
      [sessionKeyPayload],
      [fixtures.wallet.address],
    );
    const deployTxReceipt = await deployTx.wait();
    proxyAccountAddress = deployTxReceipt!.contractAddress!;

    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");

    const account = ERC7579Account__factory.connect(proxyAccountAddress, provider);
    assert(await account.k1IsOwner(fixtures.wallet.address));
    assert(await account.isHook(sessionKeyModuleAddress), "session key module should be a hook");
  });

  it("should create a session", async () => {
    const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: proxyAccountAddress });
    await fundTx.wait();

    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();

    const smartAccount = new SmartAccount({
      address: proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    expect(await sessionKeyModuleContract.sessions(proxyAccountAddress)).to.equal(1, "no session should exist yet");

    sessionOwner = new Wallet(Wallet.createRandom().privateKey, provider);
    sessionTarget = Wallet.createRandom().address;

    const newSession: NewSessionStruct = {
      signer: sessionOwner.address,
      expiry: 1921684352, // 2030-10-16
      feeLimit: parseEther("1"),
      policies: [
        {
          target: sessionTarget,
          selector: '0x00000000',
          maxValuePerUse: parseEther("0.1"),
          isValueLimited: false,
          valueLimit: 0,
          constraints: []
        }
      ]
    };

    const aaTx = {
      ...await aaTxTemplate(),
      to: await sessionKeyModuleContract.getAddress(),
      data: sessionKeyModuleContract.interface.encodeFunctionData("createSession", [newSession]),
      gasLimit: 100_000_000n, // FIXME idk why but gas estimation doesn't work
    };
    // aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    await tx.wait();

    expect(await sessionKeyModuleContract.sessions(proxyAccountAddress)).to.equal(2, "session should be created");
  });


  it("should use a session key to send a transaction", async () => {
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const sessionKeyModuleAddress = await sessionKeyModuleContract.getAddress();

    const smartAccount = new SmartAccount({
      payloadSigner: async (hash) => abiCoder.encode(
        ["bytes", "address", "bytes[]"],
        [
          sessionOwner.signingKey.sign(hash).serialized,
          sessionKeyModuleAddress,
          ["0x"]
        ]
      ),
      address: proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const aaTx = {
      ...await aaTxTemplate(),
      to: sessionTarget,
      value: parseEther("0.1"),
      gasLimit: 100_000_000n,
    };
    // aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    await tx.wait();

    expect(await provider.getBalance(sessionTarget)).to.equal(parseEther("0.1"), "session target should have received the funds");
  });

});

