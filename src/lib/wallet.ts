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
import type { Transport } from "viem";
import { createConfig, http } from "wagmi";
import { RPC_URL, chain } from "./chain/config";

/** WalletConnect Cloud project id. Without it, only browser-extension wallets work. */
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const hasWalletConnect = projectId.length > 0;

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
  chains: [chain],
  connectors,
  transports: { [chain.id]: http(RPC_URL) } as Record<(typeof chain)["id"], Transport>,
  ssr: true,
});
