import { deployContract } from "./utils";

export default async function () {
  const baseTokenURI = "http://localhost:3006/nft/metadata.json";
  await deployContract("ZeekNFTQuest", [baseTokenURI]);
}
