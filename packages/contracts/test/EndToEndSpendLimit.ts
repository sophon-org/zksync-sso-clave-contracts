
import { SmartAccount, types, utils } from "zksync-ethers";
import { deployFactory } from "./AccountAbstraction"
import { parseEther, randomBytes, Wallet } from 'ethers';
import { AbiCoder, Contract, ContractTransactionReceipt, ContractTransactionResponse, ethers, Interface, ZeroAddress } from "ethers";
import { it } from "mocha";
import { deployContract, getWallet, getProvider } from "./utils";
import { assert, expect } from "chai";
import { readFile } from "fs/promises";
import { getPublicKeyBytes } from "./PasskeyModule";

import { toSmartAccount } from 'viem/zksync';
import { Address } from "viem";

class ContractFixtures {

    // eraTestNodeRichKey
    wallet = getWallet("0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e");

    private _aaFactory: Contract;
    async getAaFactory() {
        if (!this._aaFactory) {
            const expectedAddress = "0x23b13d016E973C9915c6252271fF06cCA2098885";
            this._aaFactory = await deployFactory("AAFactory", this.wallet, expectedAddress);
        }
        return this._aaFactory;
    }

    private _passkeyModuleContract: Contract;

    async getPasskeyModuleContract() {
        if (!this._passkeyModuleContract) {
            const expectedAddress = "0x9c1a3d7C98dBF89c7f5d167F2219C29c2fe775A7";
            this._passkeyModuleContract = await deployContract("SessionPasskeySpendLimitModule", [], { wallet: this.wallet }, expectedAddress);
        }
        return this._passkeyModuleContract
    }

    private _expensiveVerifierContract: Contract;
    async getExpensiveVerifierContract() {
        if (!this._expensiveVerifierContract) {
            const expectedAddress = "0xCeAB1fc2693930bbad33024D270598c620D7A52B";
            this._expensiveVerifierContract = await deployContract("PasskeyValidator", [], { wallet: this.wallet }, expectedAddress);
        }
        return this._expensiveVerifierContract
    }
    private _accountImplContract: Contract;
    async getAccountImplContract() {
        if (!this._accountImplContract) {
            const expectedAddress = "0x99E12239CBf8112fBB3f7Fd473d0558031abcbb5";
            this._accountImplContract = await deployContract("ERC7579Account", [], { wallet: this.wallet }, expectedAddress);
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
    private _proxyAccountContract: Contract;
    async getProxyAccountContract() {
        if (!this._proxyAccountContract) {
            const claveAddress = await this.getAccountImplAddress();
            const expectedAddress = "0xaAF5f437fB0524492886fbA64D703df15BF619AE";
            this._proxyAccountContract = await deployContract("AccountProxy", [claveAddress], { wallet: this.wallet }, expectedAddress);
        }
        return this._proxyAccountContract;
    }
}

describe.only("Spend limit validation", function () {

    const fixtures = new ContractFixtures()

    // let ERC7579 = new Interface(erc7579ABI);
    const abiCoder = new AbiCoder();

    // this was sampled from the test and if the test transaction changes this will need to be updated
    const savedHash = "";

    // this is generated externally from the saved hash
    const savedSignature = `0x{savedHash}`;

    // This is a binary object formatted by @simplewebauthn that contains the alg type and public key
    const passkeyBytes = new Uint8Array([
        165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 167, 69,
        109, 166, 67, 163, 110, 143, 71, 60, 77, 232, 220, 7,
        121, 156, 141, 24, 71, 28, 210, 116, 124, 90, 115, 166,
        213, 190, 89, 4, 216, 128, 34, 88, 32, 193, 67, 151,
        85, 245, 24, 139, 246, 220, 204, 228, 76, 247, 65, 179,
        235, 81, 41, 196, 37, 216, 117, 201, 244, 128, 8, 73,
        37, 195, 20, 194, 9
    ]);
    // that needs to be converted from 77 to 64 bytes
    const xyPublicKey = getPublicKeyBytes(passkeyBytes);

    interface TokenConfig {
        token: string; // address
        publicKey: Buffer; // bytes
        limit: ethers.BigNumberish; // uint256
    }

    const tokenConfig: TokenConfig =
    {
        token: "0xAe045DE5638162fa134807Cb558E15A3F5A7F853",
        publicKey: xyPublicKey,
        limit: ethers.toBigInt(1000)
    };
    // Define the types array corresponding to the struct
    const tokenConfigTypes = [
        "address", // token
        "bytes",   // publicKey
        "uint256"  // limit
    ];
    const moduleData = abiCoder.encode(
        [`tuple(${tokenConfigTypes.join(",")})[]`], // Solidity equivalent: TokenConfig[]
        [[tokenConfig].map(config => [
            config.token,
            config.publicKey,
            config.limit
        ])]
    );

    it("should deploy module", async () => {
        const passkeyModuleContract = await fixtures.getPasskeyModuleContract();
        assert(passkeyModuleContract != null, "No module deployed");
    });

    it("should deploy verifier", async () => {
        const expensiveVerifierContract = await fixtures.getExpensiveVerifierContract();
        assert(expensiveVerifierContract != null, "No verifier deployed");
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

        const expensiveVerifierContract = await fixtures.getExpensiveVerifierContract();
        assert(expensiveVerifierContract != null, "no verifier available");

        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            xyPublicKey,
            expensiveVerifierContract,
            await passkeyModule.getAddress(),
            moduleData
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

        console.log(`New 7579 Account created: ${proxyAccountAddress}`);
        console.log("Contract address", proxyAccountTxReceipt.contractAddress);

        expect(proxyAccountAddress, "the proxy account location").to.not.equal(ZeroAddress, "be a valid address");
    });

    it("should add passkey and verifier to account", async () => {
        //
        // PART ONE: Initialize ClaveAccount implemention, verifier module, spendlimit module, and factory
        //
        const aaFactoryContract = await fixtures.getAaFactory();
        assert(aaFactoryContract != null, "No AA Factory deployed");

        // Need to better wrap: 0x100. otherwise gas is high!
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();

        const moduleAddress = await (await fixtures.getPasskeyModuleContract()).getAddress();
        //
        // PART TWO: Install Module with passkey (salt needs to be random to not collide with other tests)
        //
        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            xyPublicKey,
            expensiveVerifierAddress,
            moduleAddress,
            moduleData
        );
        const proxyAccountTxReceipt = await proxyAccount.wait();

        assert(proxyAccountTxReceipt.contractAddress != ethers.ZeroAddress, "valid proxy account address");
    });

    it("should set spend limit via module", async () => {
        const verifierContract = await fixtures.getExpensiveVerifierContract();
        const expensiveVerifierAddress = await verifierContract.getAddress();
        const moduleContract = await fixtures.getPasskeyModuleContract();
        const moduleAddress = await moduleContract.getAddress();
        const proxyAccount = await await (await fixtures.getAaFactory()).deployProxy7579Account(
            randomBytes(32),
            await fixtures.getAccountImplAddress(),
            xyPublicKey,
            expensiveVerifierAddress,
            moduleAddress,
            moduleData
        );

        const proxyAccountReciept = await proxyAccount.wait();
        const proxyAccountAddress = proxyAccountReciept.contractAddress;
        await (
            await fixtures.wallet.sendTransaction({
                to: proxyAccountAddress,
                value: parseEther('0.002'),
            })
        ).wait();
        const claveArtifact = JSON.parse(await readFile('artifacts-zk/src/ClaveAccount.sol/ClaveAccount.json', 'utf8'));

        // send signed transaction to update spend limit on module
        // FIXME: show the real hashing of the transaction instead of just the data snapshot
        const authenticatorData = 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABQ'
        const clientData = 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiZFhPM3ctdWdycS00SkdkZUJLNDFsZFk1V2lNd0ZORDkiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQ'
        const b64SignedChallenge = 'MEUCIQCYrSUCR_QUPAhvRNUVfYiJC2JlOKuqf4gx7i129n9QxgIgaY19A9vAAObuTQNs5_V9kZFizwRpUFpiRVW_dglpR2A'

        // steps to get the data for this test
        // 1. build the transaction here in the test
        // 2. use this sample signer to get the transaction hash of a realistic transaction
        // 3. take that transaction hash to another app, and sign it (as the challange)
        // 4. bring that signed hash back here and have it returned as the signer
        const isTestMode = false;
        const extractSigningHash = (hash, secretKey, provider) => { console.log("signing payload", hash); return Promise.resolve<string>(hash); }
        const ethersTestSmartAccount = new SmartAccount({ payloadSigner: extractSigningHash, address: proxyAccountAddress, secret: xyPublicKey }, getProvider())

        /* viem code that's harder to build a transaction with
        const sampleKey = ({ sign: (hash) => { console.log("signing hash", hash); return Promise.resolve<`0x${string}`>(`0x${sampleKey}`); } });
        const testSigner = ({ sign: (hash) => { if (hash == savedHash) { return savedSignature as `0x${string}` } else { throw "hash was updated, please regen the signature! 😊" } } });
        const viemTestSmartAccount = toSmartAccount({
            address: proxyAccountAddress,
            sign: async ({ hash }) => {
                const sessionKeySigner = isTestMode ? testSigner : sampleKey;
                return sessionKeySigner.sign({ hash });
            },
        });
        */

        // sessions are just EOAs
        const provider = getProvider();
        const sessionKeyWallet = Wallet.createRandom(provider)

        const callData = moduleContract.interface.encodeFunctionData('addSessionKey', [sessionKeyWallet.address, tokenConfig.token, 100]);
        const aaTx = {
            type: 113,
            from: proxyAccountAddress,
            to: moduleAddress as Address,
            data: callData as Address, // not address?
            chainId: (await provider.getNetwork()).chainId,
            nonce: await provider.getTransactionCount(proxyAccountAddress),
            gasPrice: await provider.getGasPrice(),
            customData: {
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
            } as types.Eip712Meta,
        };

        aaTx['gasLimit'] = await provider.estimateGas(aaTx);

        const signedTransaction = await ethersTestSmartAccount.signTransaction(aaTx);
        assert(signedTransaction != null, "valid transaction to sign")

        await provider.broadcastTransaction(signedTransaction)
    })
})