import Link from "next/link";
import { accountLimits, lastRegisterRefusal } from "@/lib/limits";

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// Shown when a board's last register was refused (docs/specs/finished/multi-user-accounts.md §2.4).
export async function RefusedRegisterBanner({ userId }: { userId: string }) {
  const refusal = await lastRegisterRefusal(userId);
  if (!refusal) return null;
  const limits = await accountLimits(userId);
  const text =
    refusal.reason === "limit_reached:switches"
      ? `A new switch was refused: this account can have ${count(limits.switches, "switch", "switches")}.`
      : refusal.reason === "limit_reached:bridges"
        ? `A new Bridge was refused: this account can have ${count(limits.bridges, "Bridge", "Bridges")}.`
        : refusal.reason === "payload_too_large"
          ? `A board's Bridge snapshot was refused: it is over ${limits.snapshotKb} KB.`
          : "A board's last check-in was refused.";
  return (
    <p className="rounded-xl border border-warn bg-warn-soft p-4 text-sm" role="status">
      {text} Remove a switch or Bridge you no longer use, or ask the admin to raise the limit.
      Boards keep running their saved recipes. <Link href="/account" className="underline underline-offset-4">Account</Link>
    </p>
  );
}
