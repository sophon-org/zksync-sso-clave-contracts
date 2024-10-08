
import { SmartAccount, types, utils, Wallet } from "zksync-ethers";
import { parseEther, randomBytes } from 'ethers';
import { AbiCoder, ethers, ZeroAddress } from "ethers";
import { it } from "mocha";
import { logInfo, getWallet, getProvider, create2, deployFactory, LOCAL_RICH_WALLETS } from "./utils";
import { assert, expect } from "chai";
import * as hre from "hardhat";

import type { PasskeyValidator, ERC7579Account, SessionPasskeySpendLimitModule, AAFactory } from "../typechain-types";
import { AAFactory__factory, SessionPasskeySpendLimitModule__factory, ERC7579Account__factory } from "../typechain-types";

export class ContractFixtures {
    // NOTE: CHANGING THE READONLY VALUES WILL REQUIRE UPDATING THE STATIC SIGNATURE
    readonly wallet: Wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    // Below Private Key was randomly generated for testing purposes
    readonly sessionKeyWallet: Wallet = getWallet("0xf51513036f18ef46508ddb0fff7aa153260ff76721b2f53c33fc178152fb481e");
    readonly ethersStaticSalt = new Uint8Array([
        205, 241, 161, 186, 101, 105, 79,
        248, 98, 64, 50, 124, 168, 204,
        200, 71, 214, 169, 195, 118, 199,
        62, 140, 111, 128, 47, 32, 21,
        177, 177, 174, 166
    ]);
    readonly viemStaticSalt = new Uint8Array([
        0, 0, 0, 0, 0, 0, 0,
        248, 98, 64, 50, 124, 168, 204,
        200, 71, 214, 169, 195, 118, 199,
        62, 140, 111, 128, 47, 32, 21,
        177, 177, 174, 166
    ])
    readonly tokenForSpendLimit = "0xAe045DE5638162fa134807Cb558E15A3F5A7F853";

    private _aaFactory: AAFactory;
    async getAaFactory() {
        if (!this._aaFactory) {
            this._aaFactory = await deployFactory("AAFactory", this.wallet);
        }
        return this._aaFactory;
    }

    private _passkeyModuleContract: SessionPasskeySpendLimitModule;
    async getPasskeyModuleContract() {
        if (!this._passkeyModuleContract) {
            this._passkeyModuleContract = <any>await create2("SessionPasskeySpendLimitModule", this.wallet, this.ethersStaticSalt);
        }
        return this._passkeyModuleContract
    }

    private _expensiveVerifierContract: PasskeyValidator;
    async getExpensiveVerifierContract() {
        if (!this._expensiveVerifierContract) {
            this._expensiveVerifierContract = <any>await create2("PasskeyValidator", this.wallet, this.ethersStaticSalt);
        }
        return this._expensiveVerifierContract
    }
    private _accountImplContract: ERC7579Account;
    async getAccountImplContract() {
        if (!this._accountImplContract) {
            this._accountImplContract = <any>await create2("ERC7579Account", this.wallet, this.ethersStaticSalt);
        }
        return this._accountImplContract;
    }

    private _accountImplAddress: string;
    async getAccountImplAddress() {
        if (!this._accountImplAddress) {
            const accountImpl = await this.getAccountImplContract();
            this._accountImplAddress = await accountImpl.getAddress();
        }
        return this._accountImplAddress
    }

    private _proxyAccountContract: ERC7579Account;
    async getProxyAccountContract() {
        const claveAddress = await this.getAccountImplAddress();
        if (!this._proxyAccountContract) {
            this._proxyAccountContract = <any>await create2("AccountProxy", this.wallet, this.ethersStaticSalt, [claveAddress]);
        }
        return this._proxyAccountContract;
    }
}

describe.only("Basic tests", function () {
    const fixtures = new ContractFixtures();
    const abiCoder = new AbiCoder();
    const provider = getProvider();
    let proxyAccountAddress: string;

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

        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            [fixtures.wallet.address],
            [],
            [],
            [],
            []
        );
        const proxyAccountTxReceipt = await proxyAccount.wait();

        const newAddress = abiCoder.decode(["address"], proxyAccountTxReceipt!.logs[0].data);
        proxyAccountAddress = newAddress[0];

        expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");
        expect(proxyAccountTxReceipt!.contractAddress, "the proxy account location via return").to.not.equal(ZeroAddress, "be a non-zero address");
    });

    it("should execute a simple transfer of ETH", async () => {
        const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("1.0"), to: proxyAccountAddress });
        await fundTx.wait();

        const account = ERC7579Account__factory.connect(proxyAccountAddress, provider);
        console.log(await account.k1IsOwner(fixtures.wallet.address));
        const owners = await account.k1ListOwners()
        console.log("owners", owners);

        const smartAccount = new SmartAccount({
            payloadSigner: async (hash) => { let sig = fixtures.wallet.signingKey.sign(hash).serialized; console.log(sig); return sig; },
            address: proxyAccountAddress,
            secret: fixtures.sessionKeyWallet.privateKey
        }, provider);

        const aaTx = {
            type: 113,
            from: proxyAccountAddress,
            to: ZeroAddress,
            value: 0,// parseEther("0.5"),
            chainId: (await provider.getNetwork()).chainId,
            nonce: await provider.getTransactionCount(proxyAccountAddress),
            gasPrice: await provider.getGasPrice(),
            customData: { gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT }
        };

        aaTx['gasLimit'] = await provider.estimateGas(aaTx);

        const signedTransaction = await smartAccount.signTransaction(aaTx);
        assert(signedTransaction != null, "valid transaction to sign");

        const tx = await provider.broadcastTransaction(signedTransaction);
        await tx.wait();

        console.log(ethers.formatEther(await provider.getBalance(proxyAccountAddress)));
    })
})
