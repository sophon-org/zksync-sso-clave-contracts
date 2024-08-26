import { utils, Wallet, Provider } from "zksync-ethers";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// load env file
import dotenv from "dotenv";
dotenv.config();

// default to era test node key
const DEPLOYER_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "0x3d3cbc973389cb26f657686445bcc75662b415b656078503592ac8c1abb8810e";

export default async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore target zkSyncSepoliaTestnet in config file which can be testnet or local
  const provider = new Provider(hre.config.networks.inMemoryNode.url);
  const wallet = new Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const deployer = new Deployer(hre, wallet);
  const factoryArtifact = await deployer.loadArtifact("AAFactory");
  const testAaArtifact = await deployer.loadArtifact("Account");
  const standardAaArtifact = await deployer.loadArtifact("ERC7579Account");

  const factory = await deployer.deploy(
    factoryArtifact,
    [utils.hashBytecode(testAaArtifact.bytecode), utils.hashBytecode(standardAaArtifact.bytecode)],
    undefined,
    undefined,
    [testAaArtifact.bytecode, standardAaArtifact.bytecode]);
  const factoryAddress = await factory.getAddress();
  console.log(`AA factory address: ${factoryAddress}`);

  const aaFactory = new ethers.Contract(factoryAddress, factoryArtifact.abi, wallet);

  const owner = Wallet.createRandom();
  console.log("SC Account owner pk: ", owner.privateKey);

  const salt = ethers.ZeroHash;
  const userId = BigInt(Math.floor((Math.random() * 10000))).toString()
  const tx = await aaFactory.deployLinkedSocialAccount(salt, userId, "hardhat", owner.address);
  await tx.wait();

  const abiCoder = new ethers.AbiCoder();
  const accountAddress = utils.create2Address(factoryAddress, await aaFactory.testAaBytecodeHash(), salt, abiCoder.encode(["address"], [owner.address]));

  console.log(`SC Account deployed on address ${accountAddress}`);

  console.log("Funding smart contract account with some ETH");
  await (
    await wallet.sendTransaction({
      to: accountAddress,
      value: ethers.parseEther("0.02"),
    })
  ).wait();
  console.log(`Done!`);
}
