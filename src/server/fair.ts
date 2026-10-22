import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";

// Provably fair draws. Each user has a secret server seed whose SHA-256 hash is
// shown in their profile before they buy, a client seed they can change, and a
// nonce that increases with every pack. Pack i draws from
//   HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${round}`)
// After the user rotates their seed, the old server seed is revealed so every
// past pack can be re-computed and checked against the published hash.

export const newServerSeed = () => {
  const seed = randomBytes(32).toString("hex");
  return { seed, hash: sha256(seed) };
};

export const newClientSeed = () => randomBytes(8).toString("hex");

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Deterministic stream of floats in [0, 1) for one pack. */
export function fairRng(serverSeed: string, clientSeed: string, nonce: number) {
  let round = 0;
  let buf = Buffer.alloc(0);
  let offset = 0;
  return () => {
    if (offset + 4 > buf.length) {
      buf = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${round++}`).digest();
      offset = 0;
    }
    const v = buf.readUInt32BE(offset) / 2 ** 32;
    offset += 4;
    return v;
  };
}
