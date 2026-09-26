import { Shell } from "@/app/shell";
import { HowToGuide } from "@/app/how-to/how-to-guide";
import { requireSessionUser } from "@/lib/auth";
import { currentVersion } from "@/lib/firmware";
import { isProduct } from "@/lib/how-to";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "How-to",
};

export default async function HowToPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireSessionUser();
  const { product } = await searchParams;
  // The Round's Wi-Fi screen shows the firmware version; this one is what /setup flashes now.
  const version = await currentVersion("round").catch(() => null);

  return (
    <Shell email={user.email}>
      <HowToGuide
        version={version}
        initial={isProduct(product) ? product : "round"}
        fromQuery={isProduct(product)}
      />
    </Shell>
  );
}
