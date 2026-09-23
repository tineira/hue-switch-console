import Link from "next/link";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "How-to",
};

// Blink timings live in globals.css (.led-*) and mirror led.h in hue-simple-switch.
type Pattern = "fast" | "burst-2" | "burst-3" | "burst-4" | "heart" | "solid";

type Fix = { text: string; href?: string; link?: string };

const STEPS: {
  pattern: Pattern;
  see: string;
  state: string;
  means: string;
  fix?: Fix;
  ready?: boolean;
}[] = [
  {
    pattern: "fast",
    see: "Fast blink, no pause",
    state: "No Wi-Fi",
    means: "The board is not on Wi-Fi.",
    fix: { text: "Connect the board over USB and save Wi-Fi on", href: "/devices", link: "Devices" },
  },
  {
    pattern: "burst-2",
    see: "Two blinks, then a pause",
    state: "Needs console",
    means: "Wi-Fi is up. The console address or the device token is missing.",
    fix: { text: "Save a token on", href: "/devices", link: "Devices" },
  },
  {
    pattern: "burst-3",
    see: "Three blinks, then a pause",
    state: "Needs pairing",
    means:
      "The board cannot use the Hue Bridge yet. It is not paired, pairing is running, or the Bridge is missing or rejected the board.",
    fix: {
      text: "Hold BOOT for about 3 seconds, or use Pair on Devices, then press the button on the Hue Bridge.",
    },
  },
  {
    pattern: "burst-4",
    see: "Four blinks, then a pause",
    state: "Needs a recipe",
    means: "The Bridge is paired, and no recipes are saved.",
    fix: { text: "Save at least one recipe on", href: "/", link: "Bridge" },
  },
  {
    pattern: "heart",
    see: "One short blink about every 3 seconds",
    state: "Ready",
    means:
      "Wi-Fi, the console, the Bridge, and at least one recipe are set. One recipe on any channel is enough. A press that does not reach the Bridge does not change the pattern.",
    ready: true,
  },
];

function Led({ pattern, label }: { pattern: Pattern; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`led led-${pattern}`}
    />
  );
}

export default async function HowToPage() {
  const user = await requireSessionUser();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">How-to</h1>
      </section>

      <section className="flex max-w-2xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Simple switch · LED status</h2>
          <p className="text-sm text-muted">
            The orange LED on the XIAO shows which setup step the board is on.
            Match the blink, then follow the fix.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step.pattern}
              className={`flex gap-4 rounded-xl border p-4 ${
                step.ready ? "border-ok/40 bg-ok-soft" : "border-line bg-cream"
              }`}
            >
              <div className="flex w-10 shrink-0 flex-col items-center gap-2 pt-1">
                <Led pattern={step.pattern} label={step.see} />
                <span className="text-xs text-muted tabular-nums">{i + 1}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`font-semibold ${step.ready ? "text-ok" : "text-foreground"}`}
                  >
                    {step.state}
                  </span>
                  <span className="text-xs text-muted">{step.see}</span>
                </p>
                <p className="text-muted">{step.means}</p>
                {step.fix ? (
                  <p className="text-foreground">
                    <span className="font-medium">Fix: </span>
                    {step.fix.text}
                    {step.fix.href ? (
                      <>
                        {" "}
                        <Link
                          href={step.fix.href}
                          className="text-filament underline underline-offset-2"
                        >
                          {step.fix.link}
                        </Link>
                        .
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex gap-4 rounded-xl border border-danger/50 bg-danger-soft p-4">
          <div className="flex w-10 shrink-0 justify-center pt-1">
            <Led pattern="solid" label="Solid on" />
          </div>
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-danger">Error</span>
              <span className="text-xs text-muted">Solid on</span>
            </p>
            <p className="text-muted">
              The console rejected the device token, or the console task on the
              board did not start. This wins over every blink, and losing Wi-Fi
              does not turn it off.
            </p>
            <p className="text-foreground">
              <span className="font-medium">Fix: </span>
              Save a new token on{" "}
              <Link href="/devices" className="text-filament underline underline-offset-2">
                Devices
              </Link>
              . It clears once the console accepts the board.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted">
          The red charge LED, BOOT, and RESET are not part of this list.
        </p>
      </section>
    </Shell>
  );
}
