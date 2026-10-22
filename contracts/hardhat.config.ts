import "@nomicfoundation/hardhat-toolbox-viem";
import type { HardhatUserConfig } from "hardhat/config";

// Deployments to BSC are done from the PokéCast admin panel with the owner's own
// wallet, so no private key ever needs to live in this repo.
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 500 }, evmVersion: "cancun" },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
  },
};

export default config;
