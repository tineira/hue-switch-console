import Link from "next/link";
import { redirect } from "next/navigation";
import { StateVisual } from "@/app/how-to/visuals";
import { ThemePicker } from "@/app/theme-picker";
import { signupMode } from "@/lib/account-config";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hue Switch Console: Wi-Fi wall switches for Philips Hue",
  description:
    "Set up Wi-Fi wall switches for Philips Hue from your browser and choose what each button does. Free.",
};

const PRIMARY =
  "rounded-md bg-filament px-4 py-2 text-sm font-medium text-filament-ink";
const SECONDARY =
  "rounded-md border border-line bg-background px-4 py-2 text-sm font-medium hover:border-filament";

const STEPS = [
  {
    title: "Install over USB",
    text: "Plug the board into your computer and open Setup in Chrome or Edge. It installs the firmware and saves your Wi-Fi. Nothing to compile.",
  },
  {
    title: "Pair with your Bridge",
    text: "Press the button on your Hue Bridge when the switch asks. It sends the console your rooms, zones, lights and scenes.",
  },
  {
    title: "Choose what it does",
    text: "Pick the room, the scenes and what a tap, double tap or hold does. The switch picks up your changes on its own.",
  },
];

const FACTS = [
  {
    title: "Runs on your home network",
    text: "Button presses go from the switch to your Hue Bridge directly. The console only stores settings; the switches keep working if it is down.",
  },
  {
    title: "Your Wi-Fi stays on the switch",
    text: "Your Wi-Fi password goes from your browser to the switch over USB and never reaches the console.",
  },
  {
    title: "Free, no tracking",
    text: "No ads and no analytics. The console is AGPL-3.0 and the firmware is MIT.",
  },
];

// Signed-out visitors see what the console is (public, for Google's brand review too).
// Signed-in users go straight to their switches.
export default async function Home() {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/switches");

  const mode = signupMode();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-5 py-8">
      <header className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight">Hue switch console</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemePicker />
          <Link href="/login" className={SECONDARY}>
            Sign in
          </Link>
        </div>
      </header>

      <section className="flex flex-col items-start gap-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          For Philips Hue
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Wall switches for your Hue lights, set up from your browser.
        </h1>
        <p className="max-w-2xl text-base text-muted">
          Build a Wi-Fi switch from a small Seeed XIAO board, install it over USB, and choose here
          what every button does. The switch talks to your Hue Bridge on your own network.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/login" className={PRIMARY}>
            {mode === "open" ? "Create an account" : "Sign in"}
          </Link>
          {mode === "invite" ? (
            <Link href="/login" className={SECONDARY}>
              Request an invite
            </Link>
          ) : null}
          <Link href="/privacy" className="text-sm text-muted underline-offset-4 hover:underline">
            Privacy
          </Link>
        </div>
        {mode === "closed" ? (
          <p className="text-sm text-muted">New accounts are not open yet.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Two switches</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="flex gap-5 rounded-xl border border-line bg-cream p-5">
            <div aria-hidden="true" className="flex w-28 shrink-0 items-center justify-center">
              <StateVisual visual={{ face: "ready" }} label="" size={112} version={null} />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-semibold">Round</h3>
              <p className="text-xs text-muted">Round touch screen · XIAO ESP32-S3</p>
              <p className="text-sm text-muted">
                Each page is a room or zone. Tap to switch it, double tap for scenes, drag the ring
                to dim, swipe to the next room.
              </p>
            </div>
          </article>
          <article className="flex gap-5 rounded-xl border border-line bg-cream p-5">
            <div aria-hidden="true" className="flex w-28 shrink-0 items-center justify-center">
              <StateVisual visual={{ led: "heart" }} label="" size={112} version={null} />
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="font-semibold">Simple</h3>
              <p className="text-xs text-muted">Wall buttons, one LED · XIAO ESP32-C6</p>
              <p className="text-sm text-muted">
                Wired to the toggle switches or push buttons in your wall. Click to switch a room,
                double-click for scenes, hold to dim.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-xl border border-line p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-filament-soft text-sm font-semibold">
                {i + 1}
              </span>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FACTS.map((fact) => (
          <div key={fact.title} className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">{fact.title}</h3>
            <p className="text-sm text-muted">{fact.text}</p>
          </div>
        ))}
      </section>

      <p className="text-xs text-muted">
        Philips Hue is a trademark of Signify. This project is independent and is not affiliated
        with, endorsed by or sponsored by Signify. XIAO is a trademark of Seeed Studio.
      </p>
    </main>
  );
}
