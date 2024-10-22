import { assert, expect } from "chai";
import { parseEther, randomBytes } from "ethers";
import { ethers, Wallet, ZeroAddress } from "ethers";
import { it } from "mocha";
import { SmartAccount, utils } from "zksync-ethers";

import { ERC7579Account__factory } from "../typechain-types";
import type { ERC20 } from "../typechain-types";
import type { SessionLib } from "../typechain-types/src/validators/SessionKeyValidator";
import { ContractFixtures } from "./EndToEndSpendLimit";
import { getProvider } from "./utils";

const fixtures = new ContractFixtures();
const abiCoder = new ethers.AbiCoder();
const provider = getProvider();

enum Condition {
  Unconstrained = 0,
  Equal = 1,
  Greater = 2,
  Less = 3,
  GreaterEqual = 4,
  LessEqual = 5,
  NotEqual = 6,
}

enum LimitType {
  Unlimited = 0,
  Lifetime = 1,
  Allowance = 2,
}

function oneYearAway() {
  const now = new Date();
  return Math.floor(+new Date(now.setFullYear(now.getFullYear() + 1)) / 1000);
}

type PartialLimit = {
  limit: ethers.BigNumberish;
  period?: ethers.BigNumberish;
};

type PartialSession = {
  expiry?: number;
  feeLimit?: PartialLimit;
  callPolicies?: {
    target: string;
    selector?: string;
    maxValuePerUse?: ethers.BigNumberish;
    valueLimit?: PartialLimit;
    constraints?: {
      condition?: Condition;
      offset: ethers.BigNumberish;
      refValue?: ethers.BytesLike;
      limit?: PartialLimit;
    }[]
  }[];
  transferPolicies?: {
    target: string;
    maxValuePerUse?: ethers.BigNumberish;
    valueLimit?: PartialLimit;
  }[]
};

class SessionTester {
  public sessionOwner: Wallet;
  public session: SessionLib.SessionSpecStruct;
  public sessionAccount: SmartAccount;

  constructor(public proxyAccountAddress: string, sessionKeyModuleAddress: string) {
    this.sessionOwner = new Wallet(Wallet.createRandom().privateKey, provider);
    this.sessionAccount = new SmartAccount({
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
  }

  async createSession(newSession: PartialSession) {
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const smartAccount = new SmartAccount({
      address: this.proxyAccountAddress,
      secret: fixtures.wallet.privateKey,
    }, provider);

    const currentSessions = await sessionKeyModuleContract.sessionsList(this.proxyAccountAddress);
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
    expect(await sessionKeyModuleContract.sessionsList(this.proxyAccountAddress))
      .to.have.lengthOf(currentSessions.length + 1, "session should be created");
  }

  async sendTxSuccess(txRequest: ethers.TransactionRequest = {}) {
    const aaTx = {
      ...await this.aaTxTemplate(),
      ...txRequest,
    };
    // FIXME gas estimation is incorrect
    // aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await this.sessionAccount.signTransaction(aaTx);
    const tx = await provider.broadcastTransaction(signedTransaction);
    await tx.wait();
  }

  async sendTxFail(tx: ethers.TransactionRequest = {}) {
    const aaTx = {
      ...await this.aaTxTemplate(),
      gasLimit: 100_000_000n,
      ...tx,
    };

    const signedTransaction = await this.sessionAccount.signTransaction(aaTx);
    await expect(provider.broadcastTransaction(signedTransaction)).to.be.reverted;
  };

  getLimit(limit?: PartialLimit): SessionLib.UsageLimitStruct {
    return limit == null ? {
      limitType: LimitType.Unlimited,
      limit: 0,
      period: 0,
    } : limit.period == null ? {
      limitType: LimitType.Lifetime,
      limit: limit.limit,
      period: 0,
    } : {
      limitType: LimitType.Allowance,
      limit: limit.limit,
      period: limit.period,
    }
  }

  getSession(session: PartialSession): SessionLib.SessionSpecStruct {
    return {
      signer: this.sessionOwner.address,
      expiry: session.expiry ?? oneYearAway(),
      // unlimited fees are not safe
      feeLimit: session.feeLimit ? this.getLimit(session.feeLimit) : this.getLimit({ limit: parseEther("0.1") }),
      callPolicies: session.callPolicies?.map((policy) => ({
        target: policy.target,
        selector: policy.selector ?? "0x00000000",
        maxValuePerUse: policy.maxValuePerUse ?? 0,
        valueLimit: this.getLimit(policy.valueLimit),
        constraints: policy.constraints?.map((constraint) => ({
          condition: constraint.condition ?? 0,
          offset: constraint.offset,
          refValue: constraint.refValue ?? ethers.ZeroHash,
          limit: this.getLimit(constraint.limit),
        })) ?? []
      })) ?? [],
      transferPolicies: session.transferPolicies?.map((policy) => ({
        target: policy.target,
        maxValuePerUse: policy.maxValuePerUse ?? 0,
        valueLimit: this.getLimit(policy.valueLimit),
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

    const sessionKeyModuleAddress = await fixtures.getSessionKeyModuleAddress();
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

  describe("Value transfer limit test", function () {
    let tester: SessionTester;
    const sessionTarget = Wallet.createRandom().address;

    it("should create a session", async () => {
      tester = new SessionTester(proxyAccountAddress, await fixtures.getSessionKeyModuleAddress());
      await tester.createSession({
        transferPolicies: [{
          target: sessionTarget,
          maxValuePerUse: parseEther("0.01")
        }]
      });
    });

    it("should use a session key to send a transaction", async () => {
      await tester.sendTxSuccess({
        to: sessionTarget,
        value: parseEther("0.01"),
        gasLimit: 10_000_000n,
      });
      expect(await provider.getBalance(sessionTarget))
        .to.equal(parseEther("0.01"), "session target should have received the funds");
    });

    it("should reject a session key transaction that goes over limit", async () => {
      await tester.sendTxFail({
        to: sessionTarget,
        value: parseEther("0.02"),
      });
    });
  });

  describe("ERC20 transfer limit", function () {
    let tester: SessionTester;
    let erc20: ERC20;
    const sessionTarget = Wallet.createRandom().address;

    it("should deploy and mint an ERC20 token", async () => {
      erc20 = await fixtures.deployERC20(proxyAccountAddress);
      expect(await erc20.balanceOf(proxyAccountAddress)).to.equal(10n**18n, "should have some tokens");
    });

    it("should create a session", async () => {
      tester = new SessionTester(proxyAccountAddress, await fixtures.getSessionKeyModuleAddress());
      await tester.createSession({
        callPolicies: [{
          target: await erc20.getAddress(),
          selector: erc20.interface.getFunction("transfer").selector,
          constraints: [
            // can only transfer to sessionTarget
            {
              offset: 0,
              refValue: ethers.zeroPadValue(sessionTarget, 32),
              condition: Condition.Equal,
            },
            // can only transfer upto 1000 tokens per tx
            // can only transfer upto 1500 tokens in total
            {
              offset: 1,
              refValue: ethers.toBeHex(1000, 32),
              condition: Condition.LessEqual,
              limit: { limit: 1500 },
            }
          ]
        }]
      });
    });

    it("should reject a session key transaction to wrong target", async () => {
      await tester.sendTxFail({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [Wallet.createRandom().address, 1n]),
      });
    });

    it("should reject a session key transaction that goes over per-tx limit", async () => {
      await tester.sendTxFail({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [sessionTarget, 1001n]),
      });
    });

    it("should successfully send a session key transaction", async () => {
      await tester.sendTxSuccess({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [sessionTarget, 1000n]),
        gasLimit: 10_000_000n,
      });
      expect(await erc20.balanceOf(sessionTarget))
        .to.equal(1000n, "session target should have received the tokens");
    });

    it("should reject a session key transaction that goes over total limit", async () => {
      await tester.sendTxFail({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [sessionTarget, 501n]),
      });
    });
  });

  // TODO: revoke key tests
  // TODO: module uninstall tests
  // TODO: session expiry tests
  // TODO: session fee limit tests
  // TODO: allowance tests
  // TODO: getters tests
});

