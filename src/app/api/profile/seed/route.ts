import { handler, requireUser } from "@/server/session";
import { rotateSeed } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { clientSeed } = (await req.json()) as { clientSeed?: string };
  return rotateSeed(address, clientSeed);
});
