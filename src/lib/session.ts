"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

// Client view of the wallet session (Sign-In with Ethereum, see /api/auth/*).

export type Me = { address: string | null; admin: boolean };

export function useMe() {
  return useQuery<Me>({
    queryKey: ["me"],
    queryFn: async () => (await fetch("/api/auth/me")).json(),
    staleTime: 30_000,
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

/** fetch() for the PokéCast API: JSON body in, JSON out, throws the server's error message. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
