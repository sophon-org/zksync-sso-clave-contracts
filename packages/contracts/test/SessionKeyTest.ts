import { assert, expect } from "chai";
import { parseEther, randomBytes } from "ethers";
import { ethers, Wallet, ZeroAddress } from "ethers";
import { it } from "mocha";
import { SmartAccount, utils } from "zksync-ethers";

import { ERC7579Account__factory } from "../typechain-types";
import { NewSessionStruct } from "../typechain-types/src/validators/SessionKeyValidator";
import { ContractFixtures } from "./EndToEndSpendLimit";
import { getProvider } from "./utils";

const fixtures = new ContractFixtures();
const abiCoder = new ethers.AbiCoder();
const provider = getProvider();

function oneYearAway() {
  const now = new Date();
  return Math.floor(+new Date(now.setFullYear(now.getFullYear() + 1)) / 1000);
}

type PartialSession = {
  expiry?: number;
  feeLimit?: bigint;
  policies?: {
    target: string;
    selector?: string;
    maxValuePerUse?: bigint;
    valueLimit?: bigint;
    constraints?: {
      condition?: bigint;
      offset: bigint;
      refValue?: ethers.BytesLike;
      usageLimit?: bigint;
      allowanceLimit?: bigint;
      timePeriod?: bigint;
    }[]
  }[];
};

class SessionTester {
  public sessionOwner: Wallet;
  public session: NewSessionStruct;

  constructor(public proxyAccountAddress: string) {
    this.sessionOwner = new Wallet(Wallet.createRandom().privateKey, provider);
  }

  target(policyIndex: number): string {
    return this.session.policies[policyIndex].target as any;
  }

  async createSession(newSession: PartialSession) {
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const smartAccount = new SmartAccount({
      address: this.proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const nextSessionId = await sessionKeyModuleContract.sessions(this.proxyAccountAddress);
    expect(nextSessionId).to.be.greaterThan(0, "should be initialized");

    this.session = this.getSession(newSession);

    const aaTx = {
      ...await this.aaTxTemplate(),
      to: await sessionKeyModuleContract.getAddress(),
      data: sessionKeyModuleContract.interface.encodeFunctionData("createSession", [this.session]),
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    const tx = await provider.broadcastTransaction(signedTransaction);
    await tx.wait();
    expect(await sessionKeyModuleContract.sessions(this.proxyAccountAddress))
      .to.equal(nextSessionId + 1n, "session should be created");
  }

  async sendTxSuccess(txRequest: ethers.TransactionRequest = {}) {
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const sessionKeyModuleAddress = await sessionKeyModuleContract.getAddress();

    const smartAccount = new SmartAccount({
      payloadSigner: async (hash) => abiCoder.encode(
        ["bytes", "address", "bytes[]"],
        [
          this.sessionOwner.signingKey.sign(hash).serialized,
          sessionKeyModuleAddress,
          ["0x"] // this array supplies data for hooks
        ]
      ),
      address: this.proxyAccountAddress,
      secret: this.sessionOwner.privateKey,
    }, provider);

    const aaTx = {
      ...await this.aaTxTemplate(),
      ...txRequest,
    };
    // FIXME gas estimation is incorrect
    // aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    const tx = await provider.broadcastTransaction(signedTransaction);
    await tx.wait();
  }

  async sendTxFail(tx: ethers.TransactionRequest = {}) {
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const sessionKeyModuleAddress = await sessionKeyModuleContract.getAddress();

    const smartAccount = new SmartAccount({
      payloadSigner: async (hash) => abiCoder.encode(
        ["bytes", "address", "bytes[]"],
        [
          this.sessionOwner.signingKey.sign(hash).serialized,
          sessionKeyModuleAddress,
          ["0x"] // this array supplies data for hooks
        ]
      ),
      address: this.proxyAccountAddress,
      secret: this.sessionOwner.privateKey,
    }, provider);

    const aaTx = {
      ...await this.aaTxTemplate(),
      gasLimit: 100_000_000n,
      ...tx,
    };

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    await expect(provider.broadcastTransaction(signedTransaction)).to.be.reverted;
  };


  getSession(session: PartialSession): NewSessionStruct {
    return {
      signer: this.sessionOwner.address,
      expiry: session.expiry ?? oneYearAway(),
      feeLimit: session.feeLimit ?? parseEther("1"),
      policies: session.policies?.map((policy) => ({
        target: policy.target,
        selector: policy.selector ?? "0x00000000",
        maxValuePerUse: policy.maxValuePerUse ?? 0,
        isValueLimited: policy.valueLimit != null,
        valueLimit: policy.valueLimit ?? 0,
        constraints: policy.constraints?.map((constraint) => ({
          condition: constraint.condition ?? 0,
          offset: constraint.offset,
          refValue: constraint.refValue ?? ethers.ZeroHash,
          isUsageLimited: constraint.usageLimit != null,
          usageLimit: constraint.usageLimit ?? 0,
          isAllowanceLimited: constraint.allowanceLimit != null,
          allowanceLimit: constraint.allowanceLimit ?? 0,
          timePeriod: constraint.timePeriod ?? 0,
        })) ?? []
      })) ?? []
    }
  }

  async aaTxTemplate() {
    return {
      type: 113,
      from: this.proxyAccountAddress,
      data: "0x",
      value: 0,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(this.proxyAccountAddress),
      gasPrice: await provider.getGasPrice(),
      customData: { gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT },
      gasLimit: 0n,
    };
  }
}

describe.only("SessionKeyModule tests", function () {
  let proxyAccountAddress: string;
  let tester: SessionTester;

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

    const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("1"), to: proxyAccountAddress });
    await fundTx.wait();

    const account = ERC7579Account__factory.connect(proxyAccountAddress, provider);
    assert(await account.k1IsOwner(fixtures.wallet.address));
    assert(await account.isHook(sessionKeyModuleAddress), "session key module should be a hook");
    assert(await account.isModuleValidator(sessionKeyModuleAddress), "session key module should be a validator");
  });

  it("should create a session", async () => {
    tester = new SessionTester(proxyAccountAddress);
    await tester.createSession({
      policies: [{
        target: Wallet.createRandom().address,
        maxValuePerUse: parseEther("0.01")
      }]
    });
  });

  it("should use a session key to send a transaction", async () => {
    await tester.sendTxSuccess({
      to: tester.target(0),
      value: parseEther("0.01"),
      gasLimit: 100_000_000n,
    });
    expect(await provider.getBalance(tester.target(0)))
      .to.equal(parseEther("0.01"), "session target should have received the funds");
  });

  it("should reject a session key transaction that goes over value limit", async () => {
    await tester.sendTxFail({
      to: tester.target(0),
      value: parseEther("0.02"),
    });
  });
});

