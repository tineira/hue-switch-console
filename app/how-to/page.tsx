import type { Metadata } from "next";
import { PublicFrame } from "@/app/public-frame";
import { Shell } from "@/app/shell";
import { HowToGuide } from "@/app/how-to/how-to-guide";
import { getSessionUser } from "@/lib/auth";
import { currentVersion } from "@/lib/firmware";
import { howToDescription, howToHref, howToTitle, readHowTo } from "@/lib/how-to-nav";

export const dynamic = "force-dynamic";

// The server renders the view the query string names (switch, topic, Simple build type), so each
// one is its own page for search (docs/specs/finished/how-to-navigation.md §2.3).
export async function generateMetadata({ searchParams }: PageProps<"/how-to">): Promise<Metadata> {
  const params = await searchParams;
  const view = readHowTo((key) => params[key]);
  return {
    title: howToTitle(view),
    description: howToDescription(view),
    alternates: { canonical: howToHref(view) },
  };
}

// Public: signed-out visitors get the same guide (docs/specs/finished/public-how-to-changelog.md §4.2).
export default async function HowToPage() {
  const user = await getSessionUser().catch(() => null);
  // The Round's Wi-Fi screen shows the firmware version; this one is what /setup flashes now.
  const version = await currentVersion("round").catch(() => null);

  const guide = <HowToGuide version={version} />;

  if (user) return <Shell email={user.email}>{guide}</Shell>;
  return <PublicFrame wide>{guide}</PublicFrame>;
}
