import { redirect } from "next/navigation";
import { normalizeMac } from "@/lib/mac";

// Old workspace URL (`?mac=` picked a switch). Pages: docs/specs/page-structure.md.
export default async function BridgePage({
  params,
  searchParams,
}: PageProps<"/bridges/[bridgeid]">) {
  const { bridgeid } = await params;
  const { mac } = await searchParams;
  const canonical = typeof mac === "string" ? normalizeMac(mac) : null;
  redirect(
    canonical
      ? `/bridges/${encodeURIComponent(bridgeid)}/switches/${canonical}`
      : `/bridges/${encodeURIComponent(bridgeid)}/switches`,
  );
}
