
import { SmartAccount, utils, types, EIP712Signer } from "zksync-ethers";
import { deployFactory } from "./AccountAbstraction"
import { AbiCoder, Contract, ContractTransactionReceipt, ContractTransactionResponse, ethers, Interface, ZeroAddress } from "ethers";
import { it } from "mocha";
import { deployContract, getWallet } from "./utils";
import { assert, expect } from "chai";
import { readFile } from "fs/promises";
import { getPublicKeyBytes } from "./PasskeyModule";

// const erc7579ABI = require('../artifacts-zk/src/ERC7579Account.sol/ERC7579Account.json').abi;

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
            this._accountImplContract = await deployContract("ClaveAccount", [], { wallet: this.wallet });
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
            this._proxyAccountContract = await deployContract("ERC7579Account", [claveAddress, this.wallet.address], { wallet: this.wallet });
        }
        return this._proxyAccountContract;
    }
}

describe.only("Spend limit validation", function () {

    const fixtures = new ContractFixtures()

    // let ERC7579 = new Interface(erc7579ABI);
    const abiCoder = new AbiCoder();

    interface TokenConfig {
        token: string; // address
        publicKey: Uint8Array; // bytes
        limit: ethers.BigNumberish; // uint256
    }

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

        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            ethers.ZeroHash,
            await fixtures.getAccountImplAddress()
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

        expect(proxyAccountAddress, "the proxy account location").to.not.equal(ZeroAddress, "be a valid address");
    });

    it.only("should add passkey and verifier to account", async () => {
        //
        // PART ONE: Initialize ClaveAccount
        //

        // This is a binary object formatted by @simplewebauthn that contains the alg type and public key
        const publicKeyEs256Bytes = new Uint8Array([
            165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 167, 69,
            109, 166, 67, 163, 110, 143, 71, 60, 77, 232, 220, 7,
            121, 156, 141, 24, 71, 28, 210, 116, 124, 90, 115, 166,
            213, 190, 89, 4, 216, 128, 34, 88, 32, 193, 67, 151,
            85, 245, 24, 139, 246, 220, 204, 228, 76, 247, 65, 179,
            235, 81, 41, 196, 37, 216, 117, 201, 244, 128, 8, 73,
            37, 195, 20, 194, 9
        ]);
        const xyPublicKey = getPublicKeyBytes(publicKeyEs256Bytes); //convert from 77 to 64 bytes
        const proxyAccountAddress = await (await fixtures.getProxyAccountContract()).getAddress();
        const claveArtifact = JSON.parse(await readFile('artifacts-zk/src/ClaveAccount.sol/ClaveAccount.json', 'utf8'));
        const eip7579Artifact = JSON.parse(await readFile('artifacts-zk/src/ERC7579Account.sol/ERC7579Account.json', 'utf8'));
        const claveAccountFunctions = new Contract(proxyAccountAddress, claveArtifact.abi, fixtures.wallet);
        const erc7579AccountFunctions = new Contract(proxyAccountAddress, eip7579Artifact.abi, fixtures.wallet);

        // 0x100 ? will need to see if this works
        const expensiveVerifierAddress = await (await fixtures.getExpensiveVerifierContract()).getAddress();

        const initTx = await claveAccountFunctions.initialize(xyPublicKey, expensiveVerifierAddress);
        await initTx.wait();
        console.log("initalized!");

        //
        // PART TWO: Install Module
        //
        const moduleTypeId = 1; // MODULE_TYPE_VALIDATOR
        const moduleAddress = await (await fixtures.getPasskeyModuleContract()).getAddress();
        const tokenConfigs: TokenConfig[] = [
            {
                token: "0xAe045DE5638162fa134807Cb558E15A3F5A7F853",
                publicKey: publicKeyEs256Bytes,
                limit: ethers.toBigInt(1000)
            },
        ];
        // Define the types array corresponding to the struct
        const tokenConfigTypes = [
            "address", // token
            "bytes",   // publicKey
            "uint256"  // limit
        ];
        const moduleData = abiCoder.encode(
            [`tuple(${tokenConfigTypes.join(",")})[]`], // Solidity equivalent: TokenConfig[]
            [tokenConfigs.map(config => [
                config.token,
                config.publicKey,
                config.limit
            ])]
        );

        // TODO: move this into the factory, as the direct deploy grants owner permissions
        const installModuleTx = await erc7579AccountFunctions.installModule(
            moduleTypeId,
            moduleAddress,
            moduleData
        );
        const response = await installModuleTx.wait();

        console.log("Module installed", response);


        // send signed transaction to update spend limit on module
        const authenticatorData = 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABQ'
        const clientData = 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiZFhPM3ctdWdycS00SkdkZUJLNDFsZFk1V2lNd0ZORDkiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQ'
        const b64SignedChallenge = 'MEUCIQCYrSUCR_QUPAhvRNUVfYiJC2JlOKuqf4gx7i129n9QxgIgaY19A9vAAObuTQNs5_V9kZFizwRpUFpiRVW_dglpR2A'

        // compare both to see what it's doing
        const smartAccount = new SmartAccount({ address: proxyAccountAddress, secret: b64SignedChallenge });

        // execute setSpendLimit within the account contract:
        // send a transaction with the sender being the smart account address,
        // and the transaction call data with the setSpendLimit function
        // with the signature of the passkey
        const populatedSmartAccountTx = await smartAccount.populateTransaction({
            type: utils.EIP712_TX_TYPE,
            customData: {
                customSignature: b64SignedChallenge,
            },
            /*
            selector: "setSpendLimit"
            publicKey: publicKeyEs256Bytes,
            limit: 1000,
            token: "0xAe045DE5638162fa134807Cb558E15A3F5A7F853",
            */
        });

        //
        // PART THREE: Validate Module works as expected
        //

        // TODO
    });

    xit("should set spend limit via module", async () => {

        const proxyTx: ContractTransactionResponse = await (await fixtures.getAaFactory()).deployProxy7579Account(
            ethers.ZeroHash,
            await fixtures.getAccountImplAddress(),
        );

        const proxyAccountReciept = await proxyTx.wait();

        // this is a binary object formatted by @simplewebauthn that contains the alg type and public key
        const publicKeyEs256Bytes = new Uint8Array([
            165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 167, 69,
            109, 166, 67, 163, 110, 143, 71, 60, 77, 232, 220, 7,
            121, 156, 141, 24, 71, 28, 210, 116, 124, 90, 115, 166,
            213, 190, 89, 4, 216, 128, 34, 88, 32, 193, 67, 151,
            85, 245, 24, 139, 246, 220, 204, 228, 76, 247, 65, 179,
            235, 81, 41, 196, 37, 216, 117, 201, 244, 128, 8, 73,
            37, 195, 20, 194, 9
        ]);

        const claveArtifact = JSON.parse(await readFile('artifacts-zk/src/ClaveAccount.sol/ClaveAccount.json', 'utf8'));
        const smartAccountProxy = new Contract(proxyAccountReciept.contractAddress, claveArtifact.abi, fixtures.wallet);

        const initTx = await smartAccountProxy.initialize(
            publicKeyEs256Bytes,
            await (await fixtures.getExpensiveVerifierContract()).getAddress());
        await initTx.wait();
        console.log("initTx", initTx)


        // send signed transaction to update spend limit on module
        // FIXME: show the real hashing of the transaction instead of just the data snapshot
        const authenticatorData = 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABQ'
        const clientData = 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiZFhPM3ctdWdycS00SkdkZUJLNDFsZFk1V2lNd0ZORDkiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQ'
        const b64SignedChallenge = 'MEUCIQCYrSUCR_QUPAhvRNUVfYiJC2JlOKuqf4gx7i129n9QxgIgaY19A9vAAObuTQNs5_V9kZFizwRpUFpiRVW_dglpR2A'

        // compare both to see what it's doing
        const smartAccount = new SmartAccount({ address: proxyAccountReciept.contractAddress, secret: b64SignedChallenge });

        // execute setSpendLimit within the account contract:
        // send a transaction with the sender being the smart account address,
        // and the transaction call data with the setSpendLimit function
        // with the signature of the passkey
        const populatedSmartAccountTx = await smartAccount.populateTransaction({
            type: utils.EIP712_TX_TYPE,
            customData: {
                customSignature: b64SignedChallenge,
            },
            /*
            selector: "setSpendLimit"
            publicKey: publicKeyEs256Bytes,
            limit: 1000,
            token: "0xAe045DE5638162fa134807Cb558E15A3F5A7F853",
            */
        });
    })
})