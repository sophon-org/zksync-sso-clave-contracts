import { assert, expect } from "chai";
import { ethers, parseEther, randomBytes } from "ethers";
import { Wallet, ZeroAddress } from "ethers";
import { it } from "mocha";
import { ContractFactory, SmartAccount, utils } from "zksync-ethers";

import { SsoAccount__factory } from "../typechain-types";
import { CallStruct } from "../typechain-types/src/batch/BatchCaller";
import { ContractFixtures, create2, ethersStaticSalt, getProvider } from "./utils";

import * as hre from "hardhat";

describe.only("Basic tests", function () {
  const fixtures = new ContractFixtures();
  const provider = getProvider();
  let proxyAccountAddress: string;

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

  it("should deploy implemention", async () => {
    const accountImplContract = await fixtures.getAccountImplContract();
    assert(accountImplContract != null, "No account impl deployed");
  });

  it.only("should deploy proxy account via factory", async () => {
    const aaFactoryContract = await fixtures.getAaFactory(ethersStaticSalt);
    assert(aaFactoryContract != null, "No AA Factory deployed");
    const factoryAddress = await aaFactoryContract.getAddress();
    console.log("factoryAddress", factoryAddress);

    const salt = ethers.ZeroHash;
    const contractArtifact = await hre.artifacts.readArtifact("AccountProxy");
    const implAddress = await fixtures.getAccountImplAddress();
    const bytecodeHash = utils.hashBytecode(contractArtifact.bytecode);
    const standardCreate2Address = utils.create2Address(implAddress, bytecodeHash, salt, "0x");
    console.log("standardCreate2Address ", standardCreate2Address);
    // standardCreate2Address should be: "0x7dd7a774a1CBCe9Fa8Ab8A639262aBde60C20FC9"
    // but the create2address thinks it should be: "0xABE9055866F575Ad8DF70d473EDb385c1deD62fC"
    const accountCode = await fixtures.wallet.provider.getCode(standardCreate2Address);

    const deployTx = await aaFactoryContract.deployProxySsoAccount(
      salt,
      "id",
      [],
      [fixtures.wallet.address],
    );
    const deployTxReceipt = await deployTx.wait();
    proxyAccountAddress = deployTxReceipt!.contractAddress!;
    console.log("proxyAccountAddress ", proxyAccountAddress);

    expect(accountCode, "expected deploy location").to.not.equal("0x", "nothing deployed here");
    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
    expect(proxyAccountAddress, "the proxy account location").to.equal(standardCreate2Address, "be what create2 returns");

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);
    assert(await account.k1IsOwner(fixtures.wallet.address));
  });

  it("should execute a simple transfer of ETH", async () => {
    const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: proxyAccountAddress });
    await fundTx.wait();

    const balanceBefore = await provider.getBalance(proxyAccountAddress);

    const smartAccount = new SmartAccount({
      address: proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const value = parseEther("0.01");
    const target = Wallet.createRandom().address;

    const aaTx = {
      ...await aaTxTemplate(),
      to: target,
      value,
      gasLimit: 300_000n,
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    const fee = receipt.gasUsed * aaTx.gasPrice;
    expect(await provider.getBalance(proxyAccountAddress)).to.equal(balanceBefore - value - fee, "invalid final balance");
    expect(await provider.getBalance(target)).to.equal(value, "invalid final balance");
  });

  it("should execute a multicall", async () => {
    const smartAccount = new SmartAccount({
      address: proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const balanceBefore = await provider.getBalance(proxyAccountAddress);
    const value = parseEther("0.01");

    const target1 = Wallet.createRandom().address;
    const target2 = Wallet.createRandom().address;
    const calls: CallStruct[] = [
      {
        target: target1,
        value,
        callData: "0x",
        allowFailure: false,
      },
      {
        target: target2,
        value,
        callData: "0x",
        allowFailure: false,
      },
    ];

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);

    const aaTx = {
      ...await aaTxTemplate(),
      to: proxyAccountAddress,
      data: account.interface.encodeFunctionData("batchCall", [calls]),
      value: value * 2n,
      gasLimit: 300_000n,
    };
    // TODO: fix gas estimation
    // aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    assert(signedTransaction != null, "valid transaction to sign");

    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    const fee = receipt.gasUsed * aaTx.gasPrice;

    expect(await provider.getBalance(proxyAccountAddress)).to.equal(balanceBefore - value * 2n - fee, "invalid final own balance");
    expect(await provider.getBalance(target1)).to.equal(value, "invalid final target-1 balance");
    expect(await provider.getBalance(target2)).to.equal(value, "invalid final target-2 balance");
  });
});
