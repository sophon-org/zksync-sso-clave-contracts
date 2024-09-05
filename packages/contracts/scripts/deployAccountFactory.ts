import { utils, Wallet, Provider, ContractFactory } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { writeFile, readFile, access } from 'node:fs/promises';
import { parse, stringify } from 'ini';
import * as ethers from "ethers";

// load env file
import dotenv from "dotenv";
import { promises } from "fs";
dotenv.config();


export default async function (hre: HardhatRuntimeEnvironment) {
    if (!process.env.WALLET_PRIVATE_KEY) {
        console.warn("No private key configured, defaulting to era test node key")
    }

    const deployerPrivateKey = process.env.WALLET_PRIVATE_KEY ?? "0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e"
    const account = await deployWithEthers(deployerPrivateKey)

    const dbLocation = './factories.ini'
    var config = await loadDatabase(dbLocation)

    if (config.factories) {
        config.factories.push(account)
    } else {
        config.factories = [account]
    }
    await writeFile("factories.ini", stringify(config))
}

async function loadDatabase(filename: string): Promise<{ [key: string]: any }> {
    const fileStat = await access(filename).then(() => true, () => false)
    if (!fileStat) {
        return parse("")
    }
    return parse(await readFile(filename, {
        encoding: 'utf-8'
    }))
}

// The idea is to keep this as a test environment for the server application,
// so instead of deploying via hardhat, using ethers is more portable
async function deployWithEthers(deployerPrivateKey: string) {
    const provider = new Provider("http://localhost:8011")
    const wallet = new Wallet(deployerPrivateKey, provider);
    const factoryArtifact = JSON.parse(await promises.readFile('artifacts-zk/src/AAFactory.sol/AAFactory.json', 'utf8'))
    const testAaArtifact = JSON.parse(await promises.readFile('artifacts-zk/src/Account.sol/Account.json', 'utf8'))
    const standardArtifact = JSON.parse(await promises.readFile('artifacts-zk/src/AccountProxy.sol/AccountProxy.json', 'utf8'))

    // dont? Bridge funds if the wallet on zkSync doesn't have enough funds.
    console.log("loaded artifacts")
    const deployer = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, wallet)
    console.log("contract loaded")
    const factory = await deployer.deploy(utils.hashBytecode(testAaArtifact.bytecode), utils.hashBytecode(standardArtifact.bytecode));
    console.log("deployed")
    const deployedFactory = await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    //const factoryAddress = "0xaAF5f437fB0524492886fbA64D703df15BF619AE"
    console.log(`AA factory address: ${factoryAddress} ${deployedFactory.deploymentTransaction()?.blockNumber}`);

    const aaFactory = new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet);

    const owner = Wallet.createRandom();
    console.log("SC Account owner pk: ", owner.privateKey);

    //const appName = "deployAccountFactoryScript"
    const appName = "passkey";
    const salt = ethers.ZeroHash;
    const ownerAddress = owner.address
    const userId = BigInt(Math.floor((Math.random() * 10000))).toString()
    // const userId = "164,1,1,3,39,32,6,33,88,32,1,225,198,148,215,144,47,241,51,75,180,52,217,117,191,52,169,107,165,65,59,86,3,148,30,119,30,162,75,161,118,162"

    const tx = await aaFactory.deployLinkedSocialAccount(
        salt,
        userId,
        appName,
        ownerAddress)
    await tx.wait();

    const abiCoder = new ethers.AbiCoder();
    const accountAddress = utils.create2Address(
        factoryAddress,
        await aaFactory.testAaBytecodeHash(),
        salt,
        abiCoder.encode(["address"], [owner.address]));

    console.log(`SC Account deployed on address ${accountAddress}`);
    await checkAddress(appName, aaFactory, userId, wallet.address)

    console.log("Funding smart contract account with some ETH");
    await (
        await wallet.sendTransaction({
            to: accountAddress,
            value: ethers.parseEther("0.02"),
        })
    ).wait();
    console.log(`Setup Done!`);
    return {
        factoryAddress, ownerPrivateKey: owner.privateKey, accountAddress, creatorAddress: wallet.address
    }
}

async function checkAddress(appName: string, factory: ethers.Contract, userId: string, creator: string) {
    console.log("accountMappings", await factory.getAddress(), appName, userId, creator)
    const address = await factory.accountMappings(appName, userId, creator);
    console.log("address ", address)
}
