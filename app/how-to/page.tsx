import type { Metadata } from "next";
import { PublicFrame } from "@/app/public-frame";
import { Shell } from "@/app/shell";
import { HowToGuide } from "@/app/how-to/how-to-guide";
import { getSessionUser } from "@/lib/auth";
import { currentVersion } from "@/lib/firmware";
import { isProduct } from "@/lib/how-to";

export const dynamic = "force-dynamic";

const DESCRIPTION = {
  round: "Set up a Round switch for Philips Hue, change what it does, and read what its screen shows.",
  simple: "Set up a Simple switch for Philips Hue, change what it does, and read what its LED shows.",
};

// The server renders one product, so each ?product= URL is its own page for search
// (docs/specs/public-how-to-changelog.md D3). Bare /how-to renders Round.
export async function generateMetadata({ searchParams }: PageProps<"/how-to">): Promise<Metadata> {
  const { product } = await searchParams;
  const id = product === "simple" ? "simple" : "round";
  return {
    title: "How-to",
    description: DESCRIPTION[id],
    alternates: { canonical: `/how-to?product=${id}` },
  };
}

// Public: signed-out visitors get the same guide (docs/specs/public-how-to-changelog.md §4.2).
export default async function HowToPage({ searchParams }: PageProps<"/how-to">) {
  const user = await getSessionUser().catch(() => null);
  const { product } = await searchParams;
  // The Round's Wi-Fi screen shows the firmware version; this one is what /setup flashes now.
  const version = await currentVersion("round").catch(() => null);

  const guide = (
    <HowToGuide
      version={version}
      initial={isProduct(product) ? product : "round"}
      fromQuery={isProduct(product)}
    />
  );

  if (user) return <Shell email={user.email}>{guide}</Shell>;
  return <PublicFrame wide>{guide}</PublicFrame>;
}
