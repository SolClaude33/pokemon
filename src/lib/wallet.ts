import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  bitgetWallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  safepalWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { bsc } from "wagmi/chains";

/** WalletConnect Cloud project id. Without it, only browser-extension wallets work. */
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const hasWalletConnect = projectId.length > 0;

// Binance-Peg USD Coin on BNB Smart Chain (18 decimals).
export const USDC_BSC = {
  address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  decimals: 18,
} as const;

export const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const recommended = [metaMaskWallet, binanceWallet, trustWallet, okxWallet];
const others = [rabbyWallet, bitgetWallet, safepalWallet, coinbaseWallet, injectedWallet];

const connectors = connectorsForWallets(
  [
    { groupName: "Popular on BNB Chain", wallets: recommended },
    { groupName: "More", wallets: hasWalletConnect ? [...others, walletConnectWallet] : others },
  ],
  { appName: "PokéCast", projectId: projectId || "pokecast-local" },
);

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors,
  transports: { [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL || undefined) },
  ssr: true,
});
