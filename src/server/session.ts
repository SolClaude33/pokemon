import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getAddress, type Address } from "viem";

// Wallet sessions: Sign-In with Ethereum proves the user owns the address, then
// a signed, HttpOnly JWT cookie carries it for 7 days.

const COOKIE = "pc_session";
const NONCE_COOKIE = "pc_nonce";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function issueNonce() {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  (await cookies()).set(NONCE_COOKIE, nonce, { ...cookieBase, maxAge: 600 });
  return nonce;
}

export async function takeNonce() {
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  jar.delete(NONCE_COOKIE);
  return nonce;
}

export async function startSession(address: Address) {
  const token = await new SignJWT({ address: getAddress(address) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, { ...cookieBase, maxAge: 7 * 24 * 3600 });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Address | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return getAddress(payload.address as string);
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser() {
  const address = await getSession();
  if (!address) throw new HttpError(401, "Sign in with your wallet first");
  return address;
}

const ADMINS = () =>
  (process.env.ADMIN_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

export const isAdmin = (address: string | null) => !!address && ADMINS().includes(address.toLowerCase());

export async function requireAdmin() {
  const address = await requireUser();
  if (!isAdmin(address)) throw new HttpError(403, "Admins only");
  return address;
}

/** Wraps a route handler: JSON in/out and HttpError → status code. */
export function handler<T>(fn: (req: Request) => Promise<T>) {
  return async (req: Request) => {
    // API routes are always per-request (cookies, database, chain), never prerendered
    await connection();
    try {
      return Response.json(await fn(req));
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
