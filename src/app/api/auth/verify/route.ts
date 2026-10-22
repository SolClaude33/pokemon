import { parseSiweMessage } from "viem/siwe";
import { publicClient } from "@/server/chain";
import { HttpError, handler, startSession, takeNonce } from "@/server/session";
import { ensureUser } from "@/server/store";

// Sign-In with Ethereum: checks nonce, domain and signature (smart-contract
// wallets included, via ERC-1271/6492) and opens a session.
export const POST = handler(async (req) => {
  const { message, signature } = (await req.json()) as { message: string; signature: `0x${string}` };
  const nonce = await takeNonce();
  const parsed = parseSiweMessage(message);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!nonce || parsed.nonce !== nonce) throw new HttpError(401, "Sign-in expired, try again");
  if (!parsed.address || parsed.domain !== host) throw new HttpError(401, "Sign-in message is for another site");
  const ok = await publicClient.verifySiweMessage({ message, signature, nonce, domain: host });
  if (!ok) throw new HttpError(401, "Signature didn't match");
  await ensureUser(parsed.address);
  await startSession(parsed.address);
  return { address: parsed.address };
});
