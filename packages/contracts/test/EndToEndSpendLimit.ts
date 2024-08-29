
import { SmartAccount, utils, types, EIP712Signer } from "zksync-ethers";
import { deployFactory } from "./AccountAbstraction"
import { AbiCoder, Contract, ContractTransactionReceipt, ContractTransactionResponse, ethers, ZeroAddress } from "ethers";
import { promises } from "fs";
import { it } from "mocha";
import { deployContract, getWallet } from "./utils";
import { assert, expect } from "chai";
import { readFile } from "fs/promises";

describe.only("Spend limit validation", function () {

    // era test node location
    const eraTestNodeRichKey = "0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e"
    const wallet = getWallet(eraTestNodeRichKey);
    let aaFactory: Contract;
    let passkeyModuleContract: Contract;
    let expensiveVerifierContract: Contract;
    let accountImplContract: Contract;
    let proxyAccountContract: Contract;
    let aaFactoryContract: Contract;
    let proxyAccountAddress: string; // Deployed from AA Factory

    it("should deploy module", async () => {
        passkeyModuleContract = await deployContract("SessionPasskeySpendLimitModule", [], { wallet });
        assert(passkeyModuleContract != null, "No module deployed");
    });

    it("should deploy verifier", async () => {
        expensiveVerifierContract = await deployContract("P256VerifierExpensive", [], { wallet });
        assert(expensiveVerifierContract != null, "No verifier deployed");
    });

    it("should deploy implemention", async () => {
        accountImplContract = await deployContract("ClaveAccount", [], { wallet });
        assert(accountImplContract != null, "No account impl deployed");
    });

    it("should deploy proxy directly", async () => {
        const accountImplAddress = await accountImplContract.getAddress();

        proxyAccountContract = await deployContract("ERC7579Account", [accountImplAddress], { wallet });
        assert(proxyAccountContract != null, "No account proxy deployed");
    });

    it("should deploy proxy account via factory", async () => {
        aaFactoryContract = await deployFactory("AAFactory", wallet);
        assert(aaFactoryContract != null, "No AA Factory deployed");

        const proxyAccount = await aaFactoryContract.deployProxy7579Account(
            ethers.ZeroHash,
            await accountImplContract.getAddress()
        );
        const proxyAccountTxReceipt: ContractTransactionReceipt = await proxyAccount.wait();

        // Extract and decode the return address from the return data/logs
        // Assuming the return data is in the first log's data field
        //
        // Alternatively, we could emit an event like:
        //      event ProxyAccountDeployed(address accountAddress)
        //
        // Then, this would be more precise with decodeEventLog()
        const newAddress = (new AbiCoder()).decode(["address"], proxyAccountTxReceipt.logs[0].data);
        proxyAccountAddress = newAddress[0];

        console.log(`New 7579 Account created: ${proxyAccountAddress}`);

        expect(proxyAccountAddress, "the proxy account location").to.not.equal(ZeroAddress, "be a valid address");
    });

    it("should add passkey and verifier to account", async () => {
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

        const claveArtifact = JSON.parse(await readFile('artifacts-zk/src/ClaveAccount.sol/ClaveAccount.json', 'utf8'));
        const smartAccountProxy = new Contract(proxyAccountAddress, claveArtifact.abi, wallet);

        const expensiveVerifierAddress = await expensiveVerifierContract.getAddress();

        const initTx = await smartAccountProxy.initialize(publicKeyEs256Bytes, expensiveVerifierAddress);
        // console.log("initTx", initTx)
    });

    xit("should set spend limit via module", async () => {
        const accountImpl = await deployContract("ClaveAccount", [], { wallet });
        const accountImplAddress = await accountImpl.getAddress();

        if (!aaFactory) {
            aaFactory = await deployFactory("AAFactory", wallet)
        }

        const proxyTx: ContractTransactionResponse = await aaFactory.deployProxy7579Account(
            ethers.ZeroHash,
            accountImplAddress
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
        const smartAccountProxy = new Contract(proxyAccountReciept.contractAddress, claveArtifact.abi, wallet);

        const expensiveVerifier = await deployContract("P256VerifierExpensive", [], { wallet });
        const expensiveVerifierAddress = await expensiveVerifier.getAddress();

        const initTx = await smartAccountProxy.initialize(publicKeyEs256Bytes, expensiveVerifierAddress);
        console.log("initTx", initTx)

        // send signed transaction to update spend limit on module
        // FIXME: show the real hashing of the transaction instead of just the data snapshot
        const authenticatorData = 'SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAABQ'
        const clientData = 'eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiZFhPM3ctdWdycS00SkdkZUJLNDFsZFk1V2lNd0ZORDkiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjUxNzMiLCJjcm9zc09yaWdpbiI6ZmFsc2UsIm90aGVyX2tleXNfY2FuX2JlX2FkZGVkX2hlcmUiOiJkbyBub3QgY29tcGFyZSBjbGllbnREYXRhSlNPTiBhZ2FpbnN0IGEgdGVtcGxhdGUuIFNlZSBodHRwczovL2dvby5nbC95YWJQZXgifQ'
        const b64SignedChallange = 'MEUCIQCYrSUCR_QUPAhvRNUVfYiJC2JlOKuqf4gx7i129n9QxgIgaY19A9vAAObuTQNs5_V9kZFizwRpUFpiRVW_dglpR2A'

        // compare both to see what it's doing
        const smartAccount = new SmartAccount({ address: proxyAccountReciept.contractAddress, secret: b64SignedChallange });

        // execute setSpendLimit within the account contract:
        // send a transaction with the sender being the smart account address,
        // and the transaction call data with the setSpendLimit function
        // with the signature of the passkey
        const populatedSmartAccountTx = await smartAccount.populateTransaction({
            type: utils.EIP712_TX_TYPE,
            customData: {
                customSignature: b64SignedChallange,
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