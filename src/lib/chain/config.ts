import { getAddress, isAddress, zeroAddress, type Address } from "viem";
import { bsc, bscTestnet, hardhat } from "viem/chains";

/** Which network PokéCast settles on: BSC mainnet in production, testnet or a local Hardhat node for development. */
export type ChainKey = "bsc" | "bscTestnet" | "localhost";

export const CHAIN_KEY = (process.env.NEXT_PUBLIC_CHAIN ?? "bsc") as ChainKey;
export const chain = { bsc, bscTestnet, localhost: hardhat }[CHAIN_KEY] ?? bsc;

/** Binance-Peg BSC-USD (USDT, BEP-20, 18 decimals). Testnet/local use a MockUSDT deployed from the admin panel. */
const MAINNET_USDT: Address = "0x55d398326f99059fF775485246999027B3197955";
export const USDT_ADDRESS = (process.env.NEXT_PUBLIC_USDT_ADDRESS || (CHAIN_KEY === "bsc" ? MAINNET_USDT : "")) as Address;
export const USDT_DECIMALS = 18;

/** Wallet that receives every payment (packs, PokéMart, shipping). Set NEXT_PUBLIC_TREASURY_ADDRESS. */
const rawTreasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim() ?? "";
export const TREASURY_ADDRESS = (isAddress(rawTreasury) && rawTreasury.toLowerCase() !== zeroAddress ? getAddress(rawTreasury) : "") as Address | "";

export const RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL || chain.rpcUrls.default.http[0];

export const explorerTx = (hash: string) => `${chain.blockExplorers?.default.url ?? ""}/tx/${hash}`;

export const explorerToken = (address: string) => `${chain.blockExplorers?.default.url ?? ""}/token/${address}`;

/** Payments are live once USDT and a valid treasury are configured. */
export const isConfigured = () => !!USDT_ADDRESS && !!TREASURY_ADDRESS;
