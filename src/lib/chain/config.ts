import type { Address } from "viem";
import { bsc, bscTestnet, hardhat } from "viem/chains";

/** Which network PokéCast settles on: BSC mainnet in production, testnet or a local Hardhat node for development. */
export type ChainKey = "bsc" | "bscTestnet" | "localhost";

export const CHAIN_KEY = (process.env.NEXT_PUBLIC_CHAIN ?? "bsc") as ChainKey;
export const chain = { bsc, bscTestnet, localhost: hardhat }[CHAIN_KEY] ?? bsc;

/** Binance-Peg BSC-USD (USDT, BEP-20, 18 decimals). Testnet/local use a MockUSDT deployed from the admin panel. */
const MAINNET_USDT: Address = "0x55d398326f99059fF775485246999027B3197955";
export const USDT_ADDRESS = (process.env.NEXT_PUBLIC_USDT_ADDRESS || (CHAIN_KEY === "bsc" ? MAINNET_USDT : "")) as Address;
export const USDT_DECIMALS = 18;

/** PokeCastPayments contract, deployed from /admin. */
export const PAYMENTS_ADDRESS = (process.env.NEXT_PUBLIC_PAYMENTS_ADDRESS || "") as Address;

export const RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL || chain.rpcUrls.default.http[0];

export const KIND = { pack: 0, listing: 1, shipping: 2 } as const;

export const explorerTx = (hash: string) => `${chain.blockExplorers?.default.url ?? ""}/tx/${hash}`;

export const isConfigured = () => !!USDT_ADDRESS && !!PAYMENTS_ADDRESS;
