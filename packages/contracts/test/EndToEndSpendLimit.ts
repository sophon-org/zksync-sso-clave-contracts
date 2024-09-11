
import { SmartAccount, types, utils } from "zksync-ethers";
import { deployFactory } from "./AccountAbstraction"
import { parseEther, randomBytes, Wallet } from 'ethers';
import { AbiCoder, Contract, ethers, ZeroAddress } from "ethers";
import { it } from "mocha";
import { deployContract, getWallet, getProvider } from "./utils";
import { assert, expect } from "chai";
import { readFile } from "fs/promises";
import { concat, getPublicKeyBytes, toBuffer, toHash, unwrapEC2Signature } from "./PasskeyModule";

import { Address } from "viem";

class ContractFixtures {

    // eraTestNodeRichKey
    wallet = getWallet("0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e");

    private _aaFactory: Contract;
    async getAaFactory() {
        if (!this._aaFactory) {
            this._aaFactory = await deployFactory("AAFactory", this.wallet);
        }
        return this._aaFactory;
    }

    private _passkeyModuleContract: Contract;

    async getPasskeyModuleContract() {
        if (!this._passkeyModuleContract) {
            this._passkeyModuleContract = await deployContract("SessionPasskeySpendLimitModule", [], { wallet: this.wallet });
        }
        return this._passkeyModuleContract
    }

    private _expensiveVerifierContract: Contract;
    async getExpensiveVerifierContract() {
        if (!this._expensiveVerifierContract) {
            this._expensiveVerifierContract = await deployContract("PasskeyValidator", [], { wallet: this.wallet });
        }
        return this._expensiveVerifierContract
    }
    private _accountImplContract: Contract;
    async getAccountImplContract() {
        if (!this._accountImplContract) {
            this._accountImplContract = await deployContract("ERC7579Account", [], { wallet: this.wallet });
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
            this._proxyAccountContract = await deployContract("AccountProxy", [claveAddress], { wallet: this.wallet });
        }
        return this._proxyAccountContract;
    }
}

describe.only("Spend limit validation", function () {

    const fixtures = new ContractFixtures()

    // let ERC7579 = new Interface(erc7579ABI);
    const abiCoder = new AbiCoder();

    // this was sampled from the test and if the test transaction changes this will need to be updated

    // This is a binary object formatted by @simplewebauthn that contains the alg type and public key
    const passkeyBytes = new Uint8Array([
        165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 234, 62,
        36, 79, 154, 99, 41, 38, 233, 152, 111, 72, 253, 1,
        136, 252, 234, 182, 186, 123, 205, 175, 35, 255, 158, 11,
        124, 97, 124, 106, 247, 55, 34, 88, 32, 134, 64, 107,
        70, 207, 82, 45, 187, 157, 41, 129, 114, 217, 45, 217,
        70, 181, 62, 219, 125, 214, 11, 143, 128, 121, 101, 153,
        10, 77, 213, 124, 241
    ]);
    // that needs to be converted from 77 to 64 bytes (32x2)
    const xyPublicKey = getPublicKeyBytes(passkeyBytes);
    const provider = getProvider();

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
        // generated from randomBytes(32), needs to be static for later hash computation
        const staticRandomSalt = new Uint8Array([
            205, 241, 161, 186, 101, 105, 79,
            248, 98, 64, 50, 124, 168, 204,
            200, 71, 214, 169, 195, 118, 199,
            62, 140, 111, 128, 47, 32, 21,
            177, 177, 174, 166
        ]);
        console.log("staticRandomSalt ", staticRandomSalt)
        const factory = await fixtures.getAaFactory()
        const accountImpl = await fixtures.getAccountImplAddress()

        // from previous deployment (Updatable!)
        let proxyAccountAddress = "0x86CBA50c2139d18511DE73e30BC385E82C6EeeC1";
        console.log("checking for account address")
        const accountCode = await provider.getCode(proxyAccountAddress);
        if (accountCode) {
            console.log("creating new account address")
            const proxyAccount = await factory.deployProxy7579Account(
                staticRandomSalt,
                accountImpl,
                xyPublicKey,
                expensiveVerifierAddress,
                moduleAddress,
                moduleData
            );

            const proxyAccountReciept = await proxyAccount.wait();
            proxyAccountAddress = proxyAccountReciept.contractAddress;
            console.log("proxyAccountAddress ", proxyAccountReciept)
            assert.notEqual(proxyAccountAddress, undefined, "no address set")
            await (
                await fixtures.wallet.sendTransaction({
                    to: proxyAccountAddress,
                    value: parseEther('0.002'),
                })
            ).wait();
        }

        const claveArtifact = JSON.parse(await readFile('artifacts-zk/src/ClaveAccount.sol/ClaveAccount.json', 'utf8'));

        // this is the encoded data explaining what authenticator was used (fido, web, etc)
        const authenticatorData = "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA";
        // this is a b64 encoded json object
        const clientData = "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiWTFFMU9TT0xuNzkzZWFGUnM0Z3RtZFdZR196TXdZMFozUk1mZGh3Nk5GTSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3MyIsImNyb3NzT3JpZ2luIjpmYWxzZX0",
        // to be safe this needs to be done client side, otherwise we lose the check that the hash is actually for the transcation in question
        const authDataBuffer = toBuffer(authenticatorData);
        const clientDataHash = await toHash(toBuffer(clientData));
        const hashedData = await toHash(concat([authDataBuffer, clientDataHash]));
        // signed challange should come from signed transaction hash (challange is the transaction hash)
        const b64SignedChallenge = "MEMCIAZJqndZ20efHbL8Xov2bojrYx0k6MRz4Q7Q-eBb9VT9Ah8nHseD4ijf5aeJJI6y33pnlbBQdGY9LLT2scN_Zjc2";
        const rs = unwrapEC2Signature(toBuffer(b64SignedChallenge))
        const sessionKeyWallet = new Wallet("0xf51513036f18ef46508ddb0fff7aa153260ff76721b2f53c33fc178152fb481e")

        // steps to get the data for this test
        // 1. build the transaction here in the test (aaTx)
        // 2. use this sample signer to get the transaction hash of a realistic transaction
        // hex: 0x63513539238b9fbf7779a151b3882d99d5981bfcccc18d19dd131f761c3a3453
        // b64: Y1E1OSOLn793eaFRs4gtmdWYG/zMwY0Z3RMfdhw6NFM=
        // 3. take that transaction hash to another app, and sign it (as the challange)
        // 4. bring that signed hash back here and have it returned as the signer
        // 
        const isTestMode = false;
        const extractSigningHash = (hash: string, secretKey, provider) => {

            /* disabled while we ignore the real hash and use the stored one
            const b64Hash = ethers.encodeBase64(hash)
            console.log("signing payload hash as binary", hash, b64Hash, ethers.decodeBase64(b64Hash));
            */

            console.log("hashedData,rs", hashedData,rs)
            // the signature will be much fatter when we include the raw data to be hashed
            // otherwise we're trusting the client to calculate the hash of the transaction correctly
            const prehashedSignature = abiCoder.encode(["bytes", "bytes32[]"], [
                hashedData,
                rs
            ])
            // clave expects sigature + validator address + validator hook data
            const fullFormattedSig = abiCoder.encode(["bytes", "address", "bytes[]"], [
                prehashedSignature,
                expensiveVerifierAddress,
                []
            ]);
            return Promise.resolve<string>(fullFormattedSig);
        }

        // smart account secret isn't stored in javascript (because it's a passkey)
        // but we do have sessionkey secret
        const ethersTestSmartAccount = new SmartAccount({ payloadSigner: extractSigningHash, address: proxyAccountAddress, secret: sessionKeyWallet.privateKey }, getProvider())

        // sessions are just EOAs, here's static randomly generated one
        console.log("sessionKeyWallet ", sessionKeyWallet.privateKey)

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