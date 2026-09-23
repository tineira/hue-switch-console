import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "How-to",
};

const STEPS = [
  {
    see: "Solid on",
    means:
      "System error. The console rejected the device token, or the console task on the board did not start. It stays solid until the console accepts the board again, or you save a new token on Devices. Losing Wi-Fi does not turn this off.",
  },
  {
    see: "Fast blink, no pause",
    means: "The board is not on Wi-Fi.",
  },
  {
    see: "Two blinks, then a pause",
    means: "Wi-Fi is up. The console address or the device token is missing.",
  },
  {
    see: "Three blinks, then a pause",
    means:
      "Wi-Fi and the console are set. The Hue Bridge is not paired. Holding BOOT for about 3 seconds to pair again uses this pattern until pairing finishes.",
  },
  {
    see: "Four blinks, then a pause",
    means: "The Bridge is paired, and no recipes are saved.",
  },
  {
    see: "One short blink about every 3 seconds",
    means:
      "Ready. Wi-Fi, the console, the Bridge, and at least one recipe are set. One recipe on any channel is enough.",
  },
] as const;

export default async function HowToPage() {
  const user = await requireSessionUser();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">How-to</h1>
        <p className="max-w-2xl text-sm text-muted">
          One section per product. This page starts with the Simple switch.
        </p>
      </section>

      <section className="flex max-w-2xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Simple switch</h2>
          <p className="text-sm text-muted">
            The orange LED is a status checklist while you can see the XIAO. It
            shows which step the board is on. It does not explain how to set
            the board up. One pattern at a time. Solid on wins over every
            blink. The red charge LED, BOOT, and RESET are not part of this
            list.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-cream">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">What you see</th>
                <th className="px-4 py-3 font-medium">What it means</th>
              </tr>
            </thead>
            <tbody>
              {STEPS.map((step) => (
                <tr key={step.see} className="border-b border-line last:border-b-0">
                  <th className="px-4 py-3 align-top font-medium text-foreground">
                    {step.see}
                  </th>
                  <td className="px-4 py-3 text-muted">{step.means}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted">
          A press that does not reach the Bridge does not change the pattern.
        </p>
      </section>
    </Shell>
  );
}
