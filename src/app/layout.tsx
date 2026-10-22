import type { Metadata, Viewport } from "next";
import { Fragment_Mono, Lilita_One, Press_Start_2P } from "next/font/google";
import { Providers } from "@/components/Providers";
import { TvShell } from "@/components/TvShell";
import "./globals.css";

const lilita = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
});

const fragment = Fragment_Mono({
  variable: "--font-fragment",
  subsets: ["latin"],
  weight: "400",
});

const pressStart = Press_Start_2P({
  variable: "--font-pressstart",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "PokéCast — Rip real Pokémon TCG packs", template: "%s · PokéCast" },
  description:
    "Buy and open real, sealed Pokémon TCG booster packs with USDC on BNB Chain. See the odds before you rip, then ship your cards home, sell them back instantly or trade them on the PokéMart.",
};

export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${lilita.variable} ${fragment.variable} ${pressStart.variable}`}>
      <body>
        <Providers>
          <TvShell>{children}</TvShell>
        </Providers>
      </body>
    </html>
  );
}
