const { deployContract } = require("./utils.cjs");

// This script is used to deploy an NFT contract
// as well as verify it on Block Explorer if possible for the network
module.exports = async function () {
  const name = "My new NFT";
  const symbol = "MYNFT";
  const baseTokenURI = "https://mybaseuri.com/token/";
  await deployContract("MyNFT", [name, symbol, baseTokenURI]);
};
