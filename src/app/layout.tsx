import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Fragment_Mono, Silkscreen } from "next/font/google";
import { Providers } from "@/components/Providers";
import { TvShell } from "@/components/TvShell";
import "./globals.css";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const fragment = Fragment_Mono({
  variable: "--font-fragment",
  subsets: ["latin"],
  weight: "400",
});

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "Holovision — Rip real Pokémon TCG packs", template: "%s · Holovision" },
  description:
    "Buy and open real, sealed Pokémon TCG booster packs with USDC on BNB Chain. See the odds before you rip, then ship your cards home or sell them back instantly.",
};

export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodoni.variable} ${fragment.variable} ${silkscreen.variable}`}>
      <body>
        <Providers>
          <TvShell>{children}</TvShell>
        </Providers>
      </body>
    </html>
  );
}
