"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wallet";

const theme = darkTheme({
  accentColor: "#ece6d6",
  accentColorForeground: "#0b0d11",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});
theme.colors.modalBackground = "#0f1116";
theme.colors.modalBorder = "rgb(236 230 214 / 0.18)";
theme.fonts.body = "var(--font-fragment), ui-monospace, monospace";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: "Holovision" }}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
