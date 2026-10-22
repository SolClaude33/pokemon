"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  createAuthenticationAdapter,
  darkTheme,
  type AuthenticationStatus,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { createSiweMessage } from "viem/siwe";
import { WagmiProvider, useAccount } from "wagmi";
import { chain } from "@/lib/chain/config";
import { api, useMe } from "@/lib/session";
import { wagmiConfig } from "@/lib/wallet";

const theme = darkTheme({
  accentColor: "#ffcb05",
  accentColorForeground: "#0c1a33",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});
theme.colors.modalBackground = "#0f1116";
theme.colors.modalBorder = "rgb(236 230 214 / 0.18)";
theme.fonts.body = "var(--font-fragment), ui-monospace, monospace";

/** Sign-In with Ethereum: after connecting, the wallet signs a message that starts a server session. */
function Auth({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useMe();
  const { address } = useAccount();

  const status: AuthenticationStatus = me.isLoading
    ? "loading"
    : me.data?.address && address && me.data.address.toLowerCase() === address.toLowerCase()
      ? "authenticated"
      : "unauthenticated";

  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => (await api<{ nonce: string }>("/api/auth/nonce")).nonce,
        createMessage: ({ nonce, address, chainId }) =>
          createSiweMessage({
            domain: window.location.host,
            address,
            statement: "Sign in to PokéCast. This does not cost gas or move any funds.",
            uri: window.location.origin,
            version: "1",
            chainId,
            nonce,
          }),
        verify: async ({ message, signature }) => {
          try {
            await api("/api/auth/verify", { message, signature });
            await qc.invalidateQueries();
            return true;
          } catch {
            return false;
          }
        },
        signOut: async () => {
          await api("/api/auth/logout", {});
          await qc.invalidateQueries();
        },
      }),
    [qc],
  );

  return (
    <RainbowKitAuthenticationProvider adapter={adapter} status={status}>
      <RainbowKitProvider theme={theme} modalSize="compact" locale="en-US" initialChain={chain} appInfo={{ appName: "PokéCast" }}>
        {children}
      </RainbowKitProvider>
    </RainbowKitAuthenticationProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Auth>{children}</Auth>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
