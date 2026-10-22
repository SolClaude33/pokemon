import { getSession, handler, isAdmin } from "@/server/session";

export const GET = handler(async () => {
  const address = await getSession();
  return { address, admin: isAdmin(address) };
});
