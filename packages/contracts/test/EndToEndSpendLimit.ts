import { promises } from "node:fs";

import { assert, expect } from "chai";
import { BytesLike, parseEther, randomBytes } from "ethers";
import { AbiCoder, Contract, ethers, ZeroAddress } from "ethers";
import * as hre from "hardhat";
import { it } from "mocha";
import { Address, Chain, createWalletClient, encodeAbiParameters, encodeFunctionData, getAddress, Hash, http, isHex, publicActions, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sendTransaction, waitForTransactionReceipt, writeContract } from "viem/actions";
import { zksyncInMemoryNode } from "viem/chains";
import { Provider, SmartAccount, types, utils, Wallet } from "zksync-ethers";

import { createZksyncSessionClient } from "../../sdk/dist/types/client/clients/session";
import { createZKsyncPasskeyClient } from "./sdk/PasskeyClient";
import { base64UrlToUint8Array, unwrapEC2Signature } from "./sdk/utils/passkey";
import { create2, deployFactory, getProvider, getWallet, LOCAL_RICH_WALLETS, logInfo, RecordedResponse } from "./utils";

// Token Config Interface definitions
interface SpendLimit {
  tokenAddress: string;
  limit: bigint;
}

interface SessionKey {
  // the public address of the session
  sessionKey: string;
  // block timestamp
  expiresAt: bigint;
  // if not de-duplicated, the last token address wins
  spendLimits: SpendLimit[];
}
export class ContractFixtures {
  // NOTE: CHANGING THE READONLY VALUES WILL REQUIRE UPDATING THE STATIC SIGNATURE
  readonly wallet: Wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  // Below Private Key was randomly generated for testing purposes
  readonly ethersSessionKeyWallet: Wallet = getWallet("0xf51513036f18ef46508ddb0fff7aa153260ff76721b2f53c33fc178152fb481e");
  readonly viemSessionKeyWallet: Wallet = getWallet(LOCAL_RICH_WALLETS[2].privateKey);
  readonly ethersStaticSalt = new Uint8Array([
    205, 241, 161, 186, 101, 105, 79,
    248, 98, 64, 50, 124, 168, 204,
    200, 71, 214, 169, 195, 118, 199,
    62, 140, 111, 128, 47, 32, 21,
    177, 177, 174, 166,
  ]);

  readonly viemStaticSalt = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0,
    248, 98, 64, 50, 124, 168, 204,
    200, 71, 214, 169, 195, 118, 199,
    62, 140, 111, 128, 47, 32, 21,
    177, 177, 174, 166,
  ]);

  readonly tokenForSpendLimit = "0xAe045DE5638162fa134807Cb558E15A3F5A7F853";

  private _aaFactory: Contract;
  async getAaFactory() {
    if (!this._aaFactory) {
      this._aaFactory = await deployFactory("AAFactory", this.wallet);
    }
    return this._aaFactory;
  }

  private _sessionSpendLimitModule: Contract;
  async getPasskeyModuleContract() {
    if (!this._sessionSpendLimitModule) {
      this._sessionSpendLimitModule = await create2("SessionPasskeySpendLimitModule", this.wallet, this.ethersStaticSalt);
    }
    return this._sessionSpendLimitModule;
  }

  private _webauthnValidatorModule: Contract;
  // does passkey validation via modular interface
  async getWebAuthnVerifierContract() {
    if (!this._webauthnValidatorModule) {
      this._webauthnValidatorModule = await create2("WebAuthValidator", this.wallet, this.ethersStaticSalt);
    }
    return this._webauthnValidatorModule;
  }

  private _accountImplContract: Contract;
  // wraps the clave account
  async getAccountImplContract() {
    if (!this._accountImplContract) {
      this._accountImplContract = await create2("ERC7579Account", this.wallet, this.ethersStaticSalt);
    }
    return this._accountImplContract;
  }

  private _accountImplAddress: string;
  // deploys the base account for future proxy use
  async getAccountImplAddress() {
    if (!this._accountImplAddress) {
      const accountImpl = await this.getAccountImplContract();
      this._accountImplAddress = await accountImpl.getAddress();
    }
    return this._accountImplAddress;
  }

  private _proxyAccountContract: Contract;
  async getProxyAccountContract() {
    const claveAddress = await this.getAccountImplAddress();
    if (!this._proxyAccountContract) {
      this._proxyAccountContract = await create2("AccountProxy", this.wallet, this.ethersStaticSalt, [claveAddress]);
    }
    return this._proxyAccountContract;
  }

  async getModuleData(sessionKey: string): Promise<SessionKey> {
    return {
      sessionKey: sessionKey,
      expiresAt: BigInt(1000000),
      spendLimits: [{
        tokenAddress: this.tokenForSpendLimit,
        limit: BigInt(1000),
      }],
    };
  }

  async getEncodedModuleData(sessionKey: string) {
    const abiCoder = new AbiCoder();

    const spendLimitTypes = [
      "address tokenAddress",
      "uint256 limit",
    ];

    const sessionKeyTypes = [
      "address sessionKey",
      "uint256 expiresAt",
      `tuple(${spendLimitTypes.join(",")})[] spendLimits`,
    ];
    return abiCoder.encode(
      [`tuple(${sessionKeyTypes.join(",")})[]`], // Solidity equivalent: SessionKey[]
      [[await this.getModuleData(sessionKey)].map((config) => [
        config.sessionKey,
        config.expiresAt,
        config.spendLimits,
      ])],
    );
  }
}

describe("Spend limit validation", function () {
  const fixtures = new ContractFixtures();
  const ethersResponse = new RecordedResponse("test/signed-challenge.json");
  const viemResponse = new RecordedResponse("test/signed-viem-challenge.json");
  const abiCoder = new AbiCoder();
  const provider = getProvider();

  it("should deploy module", async () => {
    const passkeyModuleContract = await fixtures.getPasskeyModuleContract();
    assert(passkeyModuleContract != null, "No module deployed");
  });

  it("should deploy verifier", async () => {
    const validatorModule = await fixtures.getWebAuthnVerifierContract();
    assert(validatorModule != null, "No verifier deployed");
  });

  it("should deploy implemention", async () => {
    const accountImplContract = await fixtures.getAccountImplContract();
    assert(accountImplContract != null, "No account impl deployed");
  });

  it("should deploy proxy directly", async () => {
    const proxyAccountContract = await fixtures.getProxyAccountContract();
    assert(proxyAccountContract != null, "No account proxy deployed");
  });

  it("should deploy proxy account via factory", async () => {
    const aaFactoryContract = await fixtures.getAaFactory();
    assert(aaFactoryContract != null, "No AA Factory deployed");

    const passkeyModule = await fixtures.getPasskeyModuleContract();
    assert(passkeyModule != null, "no module available");

    const validatorModule = await fixtures.getWebAuthnVerifierContract();
    assert(validatorModule != null, "no verifier available");

    const forceDeploy = await fixtures.getProxyAccountContract();
    assert(forceDeploy != null, "proxy fails");

    const sessionKeyWallet = Wallet.createRandom(getProvider());
    const webauthModuleData = abiCoder.encode(["address", "bytes"], [await validatorModule.getAddress(), await ethersResponse.getXyPublicKey()]);
    const sessionSpendModuleData = abiCoder.encode(["address", "bytes"], [await passkeyModule.getAddress(), await fixtures.getEncodedModuleData(sessionKeyWallet.address)]);
    const proxyAccount = await aaFactoryContract.deployProxy7579Account(
      randomBytes(32),
      await fixtures.getAccountImplAddress(),
      [webauthModuleData, sessionSpendModuleData],
      [],
    );
    const proxyAccountTxReceipt = await proxyAccount.wait();

    // Extract and decode the return address from the return data/logs
    // Assuming the return data is in the first log's data field
    //
    // Alternatively, we could emit an event like:
    //      event ProxyAccountDeployed(address accountAddress)
    //
    // Then, this would be more precise with decodeEventLog()
    const newAddress = abiCoder.decode(["address"], proxyAccountTxReceipt.logs[0].data);
    const proxyAccountAddress = newAddress[0];

    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
    expect(proxyAccountTxReceipt.contractAddress, "the proxy account location via return").to.not.equal(ZeroAddress, "be a non-zero address");
  });

  it("should add passkey and verifier to account", async () => {
    //
    // PART ONE: Initialize ClaveAccount implemention, verifier module, spendlimit module, and factory
    //
    const aaFactoryContract = await fixtures.getAaFactory();
    assert(aaFactoryContract != null, "No AA Factory deployed");

    const validatorModule = await fixtures.getWebAuthnVerifierContract();
    const expensiveVerifierAddress = await validatorModule.getAddress();

    const moduleAddress = await (await fixtures.getPasskeyModuleContract()).getAddress();
    //
    // PART TWO: Install Module with passkey (salt needs to be random to not collide with other tests)
    //
    const sessionKeyWallet = Wallet.createRandom(getProvider());
    const validationData = abiCoder.encode(["address", "bytes"], [expensiveVerifierAddress, await ethersResponse.getXyPublicKey()]);
    const moduleData = abiCoder.encode(["address", "bytes"], [moduleAddress, await fixtures.getEncodedModuleData(sessionKeyWallet.address)]);
    const proxyAccount = await aaFactoryContract.deployProxy7579Account(
      randomBytes(32),
      await fixtures.getAccountImplAddress(),
      [validationData],
      [moduleData],
    );
    const proxyAccountTxReceipt = await proxyAccount.wait();

    assert(proxyAccountTxReceipt.contractAddress != ethers.ZeroAddress, "valid proxy account address");
  });

  it("should set spend limit via module with ethers", async () => {
    const validatorModule = await fixtures.getWebAuthnVerifierContract();
    const validatorModuleAddress = await validatorModule.getAddress();
    const moduleContract = await fixtures.getPasskeyModuleContract();
    const moduleAddress = await moduleContract.getAddress();
    const factory = await fixtures.getAaFactory();
    const accountImpl = await fixtures.getAccountImplAddress();
    const proxyFix = await fixtures.getProxyAccountContract();
    assert(proxyFix != null, "should deploy proxy");

    const validationData = abiCoder.encode(["address", "bytes"], [await validatorModule.getAddress(), await ethersResponse.getXyPublicKey()]);
    const moduleData = abiCoder.encode(["address", "bytes"], [moduleAddress, await fixtures.getEncodedModuleData(fixtures.ethersSessionKeyWallet.address)]);
    const proxyAccount = await factory.deployProxy7579Account(
      fixtures.ethersStaticSalt,
      accountImpl,
      [validationData, moduleData],
      [moduleData],
    );

    const proxyAccountReceipt = await proxyAccount.wait();
    const proxyAccountAddress = proxyAccountReceipt.contractAddress;
    assert.isDefined(proxyAccountAddress, "no address set");
    await (
      await fixtures.wallet.sendTransaction({
        to: proxyAccountAddress,
        value: parseEther("0.002"),
      })
    ).wait();

    const authDataBuffer = base64UrlToUint8Array(ethersResponse.authenticatorData);
    const clientDataBuffer = base64UrlToUint8Array(ethersResponse.clientData);
    const rs = unwrapEC2Signature(base64UrlToUint8Array(ethersResponse.b64SignedChallenge));
    // steps to get the data for this test
    // 1. build the transaction here in the test (aaTx)
    // 2. use this sample signer to get the transaction hash of a realistic transaction
    // 3. take that transaction hash to another app, and sign it (as the challenge)
    // 4. bring that signed hash back here and have it returned as the signer
    const sessionKeySigner = (hash: BytesLike, secret?: string, provider?: null | Provider) => {
      const sessionKeySignature = fixtures.ethersSessionKeyWallet.signingKey.sign(hash);
      console.debug("(sessionkey)hash", hash, "secretKey", secret, "provider.ready", provider?.ready);
      return Promise.resolve<string>(abiCoder.encode(["bytes", "address", "bytes[]"], [
        sessionKeySignature.serialized,
        moduleAddress,
        [],
      ]));
    };

    const passkeySigner = (hash: BytesLike, secret?: string, provider?: null | Provider) => {
      console.debug("(passkey)hash", hash, "secret", secret, "provider.ready", provider?.ready);
      const fatSignature = abiCoder.encode(["bytes", "bytes", "bytes32[2]"], [
        authDataBuffer,
        clientDataBuffer,
        [rs.r, rs.s],
      ]);

      // clave expects signature + validator address + validator hook data
      const fullFormattedSig = abiCoder.encode(["bytes", "address", "bytes[]"], [
        fatSignature,
        validatorModuleAddress,
        [],
      ]);

      return Promise.resolve<string>(fullFormattedSig);
    };

    let usePasskeySigner = true;
    const configurableSigner = (hash: BytesLike, secret?: string, provider?: null | Provider) => {
      if (!usePasskeySigner) {
        return sessionKeySigner(hash, secret, provider);
      } else {
        return passkeySigner(hash, secret, provider);
      }
    };

    const ethersSmartAccount = new SmartAccount({
      payloadSigner: configurableSigner,
      address: proxyAccountAddress,
      secret: fixtures.ethersSessionKeyWallet.privateKey,
    }, getProvider());

    const tokenData = await fixtures.getModuleData(fixtures.ethersSessionKeyWallet.address);
    const callData = moduleContract.interface.encodeFunctionData("setSessionKeys", [[tokenData]]);
    const aaTx = {
      type: 113,
      from: proxyAccountAddress,
      to: moduleAddress as Address,
      data: callData,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(proxyAccountAddress),
      gasPrice: await provider.getGasPrice(),
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      } as types.Eip712Meta,
    };

    aaTx["gasLimit"] = await provider.estimateGas(aaTx);

    const passkeySignedTransaction = await ethersSmartAccount.signTransaction(aaTx);
    assert(passkeySignedTransaction != null, "valid passkey transaction to sign");

    await provider.broadcastTransaction(passkeySignedTransaction);

    // Now, let's try the session key
    usePasskeySigner = false;
    aaTx.nonce = await provider.getTransactionCount(proxyAccountAddress);
    const sessionKeySignedTransaction = await ethersSmartAccount.signTransaction(aaTx);
    assert(sessionKeySignedTransaction != null, "valid session key transaction to sign");

    await provider.broadcastTransaction(sessionKeySignedTransaction);
  });

  it("should set spend limit via module with viem", async () => {
    const validatorModule = await fixtures.getWebAuthnVerifierContract();
    const moduleContract = await fixtures.getPasskeyModuleContract();
    const factoryContract = await fixtures.getAaFactory();

    const validatorModuleAddress = await validatorModule.getAddress();
    const moduleAddress = await moduleContract.getAddress();
    const accountImpl = await fixtures.getAccountImplAddress();
    const localClient: Chain = {
      ...zksyncInMemoryNode,
      rpcUrls: {
        default: {
          http: [hre.network.config["url"]], // Override if not using the default port
        },
      },
    };

    const richWallet = createWalletClient({
      account: privateKeyToAccount(fixtures.wallet.privateKey as Hash),
      chain: localClient,
      transport: http(),
    }).extend(publicActions);

    const factoryArtifact = JSON.parse(await promises.readFile(`./artifacts-zk/src/AAFactory.sol/AAFactory.json`, "utf8"));

    const encodedValidatorData = encodeAbiParameters(
      [
        { name: "validatorAddress", type: "address" },
        { name: "validatorData", type: "bytes" },
      ],
      [getAddress(validatorModuleAddress), toHex(await viemResponse.getXyPublicKey())],
    );
    const encodedInitModuleData = await fixtures.getEncodedModuleData(fixtures.viemSessionKeyWallet.address);
    const encodedModuleData = encodeAbiParameters(
      [
        { name: "moduleAddress", type: "address" },
        { name: "moduleData", type: "bytes" },
      ],
      [getAddress(moduleAddress), isHex(encodedInitModuleData) ? encodedInitModuleData : toHex(encodedInitModuleData)],
    );
    const proxyAccount = await writeContract(richWallet, {
      address: getAddress(await factoryContract.getAddress()),
      abi: factoryArtifact.abi,
      functionName: "deployProxy7579Account",
      args: [
        toHex(fixtures.viemStaticSalt),
        accountImpl,
        [encodedValidatorData, encodedModuleData],
        [],
      ],
    });
    const proxyAccountReceipt = await waitForTransactionReceipt(richWallet, { hash: proxyAccount });
    assert.isNotNull(proxyAccountReceipt.contractAddress, "should have a contract address");
    const proxyAccountAddress = getAddress(proxyAccountReceipt.contractAddress!);

    assert.isDefined(proxyAccountAddress, "no address set");
    const chainResponse = await waitForTransactionReceipt(richWallet, {
      hash: await richWallet.sendTransaction({
        to: proxyAccountAddress,
        value: parseEther("0.05"),
      }),
    });
    assert.equal(chainResponse.status, "success", "should fund without errors");

    const passkeyClient = createZKsyncPasskeyClient({
      address: proxyAccountAddress as Address,
      chain: localClient,
      key: "wallet",
      name: "ZKsync Account Passkey Client",
      validator: getAddress(moduleAddress),
      signHash: async () => ({
        authenticatorData: viemResponse.authenticatorData,
        clientDataJSON: viemResponse.clientData,
        signature: viemResponse.b64SignedChallenge,
      }),
      transport: http(),
      userDisplayName: "",
      userName: "",
    });

    const sessionArtifact = JSON.parse(await promises.readFile("./artifacts-zk/src/validators/SessionPasskeySpendLimitModule.sol/SessionPasskeySpendLimitModule.json", "utf8"));

    const tokenConfig = await fixtures.getModuleData(fixtures.viemSessionKeyWallet.address);
    const callData = encodeFunctionData({
      abi: sessionArtifact.abi,
      functionName: "setSessionKeys",
      args: [
        [tokenConfig],
      ],
    });

    const transactionHash = await sendTransaction(passkeyClient, {
      to: moduleAddress as Address,
      data: callData as Hash,
    });

    const receipt = await waitForTransactionReceipt(passkeyClient, { hash: transactionHash });
    assert.equal(receipt.status, "success", "(passkey)addSessionKey transaction should be successful");

    // repeat with different signer
    const sessionKeyClient = createZksyncSessionClient({
      address: getAddress(proxyAccountAddress),
      sessionKey: isHex(fixtures.viemSessionKeyWallet.privateKey) ? fixtures.viemSessionKeyWallet.privateKey : toHex(fixtures.viemSessionKeyWallet.privateKey),
      contracts: {
        session: getAddress(moduleAddress),
      },
      chain: localClient,
      transport: http(),
    });

    const sessionKeyTransactionHash = await sendTransaction(sessionKeyClient, {
      to: moduleAddress as Address,
      data: callData as Hash,
    });

    const sessionKeyReceipt = await waitForTransactionReceipt(sessionKeyClient, { hash: sessionKeyTransactionHash });
    assert.equal(sessionKeyReceipt.status, "success", "(sessionkey) addSessionKey transaction should be successful");
  });

  it("should add passkey and verifier to account", async () => {
    //
    // PART ONE: Initialize ClaveAccount implemention, verifier module, spendlimit module, and factory
    //
    const aaFactoryContract = await fixtures.getAaFactory();
    assert(aaFactoryContract != null, "No AA Factory deployed");

    const validatorModule = await fixtures.getWebAuthnVerifierContract();
    const validatorModuleAddress = await validatorModule.getAddress();

    const moduleAddress = await (await fixtures.getPasskeyModuleContract()).getAddress();

    // Install Module with passkey (salt needs to be random to not collide with other tests)
    const sessionKeyWallet = Wallet.createRandom(getProvider());
    const validationData = abiCoder.encode(["address", "bytes"], [validatorModuleAddress, await ethersResponse.getXyPublicKey()]);
    const moduleData = abiCoder.encode(["address", "bytes"], [moduleAddress, await fixtures.getEncodedModuleData(sessionKeyWallet.address)]);
    const proxyAccount = await aaFactoryContract.deployProxy7579Account(
      randomBytes(32),
      await fixtures.getAccountImplAddress(),
      [validationData],
      [moduleData],
    );
    const proxyAccountTxReceipt = await proxyAccount.wait();

    assert(proxyAccountTxReceipt.contractAddress != ethers.ZeroAddress, "valid proxy account address");
  });

  // NOTE: If you just want to deploy contracts to your local node for testing,
  //       change 'it' to 'it.only' and only run this test.
  it("should deploy all contracts", async () => {
    const verifierContract = await fixtures.getWebAuthnVerifierContract();
    const moduleContract = await fixtures.getPasskeyModuleContract();
    const proxyContract = await fixtures.getProxyAccountContract();
    const erc7579Contract = await fixtures.getAccountImplContract();
    const factoryContract = await fixtures.getAaFactory();

    logInfo(`Verifier Address      : ${await verifierContract.getAddress()}`);
    logInfo(`AA Factory Address    : ${await factoryContract.getAddress()}`);
    logInfo(`Proxy Account Address : ${await proxyContract.getAddress()}`);
    logInfo(`ERC7579 Address       : ${await erc7579Contract.getAddress()}`);
    logInfo(`Module Address        : ${await moduleContract.getAddress()}`);
  });
});
