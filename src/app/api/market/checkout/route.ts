import { handler, requireUser } from "@/server/session";
import { checkoutListing } from "@/server/store";

export const POST = handler(async (req) => {
  const address = await requireUser();
  const { listingId } = (await req.json()) as { listingId: string };
  return checkoutListing(address, listingId);
});
