import { deployContract } from "./utils";

export default async function () {
  const baseTokenURI = "http://localhost:3006/nft/metadata.json";
  const nftContract = await deployContract("ZeekNFTQuest", [baseTokenURI]);

  const paymasterContract = await deployContract("NFTQuestPaymaster", [await nftContract.getAddress()]);

  console.log("NFT CONTRACT: ", await nftContract.getAddress());
  console.log("PAYMASTER CONTRACT: ", await paymasterContract.getAddress());
}
