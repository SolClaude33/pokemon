import { isAddress } from "viem";
import { explorerToken } from "./chain/config";

// Public links shown in the HUD, set per deployment (Vercel env vars, inlined at build time).

const httpsUrl = (raw?: string) => {
  try {
    const url = new URL((raw ?? "").trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** PokéCast's X (Twitter) profile — NEXT_PUBLIC_X_URL. Hidden when unset. */
export const X_URL = httpsUrl(process.env.NEXT_PUBLIC_X_URL);

/** Token contract address shown as "CA:" — NEXT_PUBLIC_CA. Hidden when unset. */
export const TOKEN_CA = (process.env.NEXT_PUBLIC_CA ?? "").trim() || null;

/** Explorer page for the CA when it is an EVM address. */
export const TOKEN_CA_URL = TOKEN_CA && isAddress(TOKEN_CA) ? explorerToken(TOKEN_CA) : null;
