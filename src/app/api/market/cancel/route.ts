import { handler, requireUser } from "@/server/session";
import { cancelListing } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { listingId } = (await req.json()) as { listingId: string };
  return cancelListing(address, listingId);
});
