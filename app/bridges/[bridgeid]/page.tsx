import { redirect } from "next/navigation";
import { normalizeMac } from "@/lib/mac";

// Old workspace URL (`?mac=` picked a switch). Pages: docs/specs/finished/page-structure.md.
export default async function BridgePage({ searchParams }: PageProps<"/bridges/[bridgeid]">) {
  const { mac } = await searchParams;
  const canonical = typeof mac === "string" ? normalizeMac(mac) : null;
  redirect(canonical ? `/switches/${canonical}` : "/switches");
}
