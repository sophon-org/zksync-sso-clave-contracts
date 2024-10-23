export const useTruncateAddress = (address: `0x${string}`) => {
  if (!address || address.length < 10) {
    throw new Error("Invalid Ethereum address");
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
