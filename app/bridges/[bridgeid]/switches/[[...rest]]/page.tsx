import { redirect } from "next/navigation";
import { normalizeMac } from "@/lib/mac";

// Briefly the switch URLs were per Bridge; they are `/switches/<mac>` now.
export default async function OldSwitchPage({
  params,
}: PageProps<"/bridges/[bridgeid]/switches/[[...rest]]">) {
  const { rest } = await params;
  const mac = rest?.[0] ? normalizeMac(rest[0]) : null;
  redirect(mac ? `/switches/${mac}` : "/switches");
}
