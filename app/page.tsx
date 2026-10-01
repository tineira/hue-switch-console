import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { StateVisual } from "@/app/how-to/visuals";
import { GitHubMark } from "@/app/landing/github-mark";
import type { Part } from "@/app/landing/parts-list";
import { RoundTrack } from "@/app/landing/round-track";
import { SimpleCard } from "@/app/landing/simple-card";
import { ThemeToggle } from "@/app/landing/theme-toggle";
import { JoinWaitlistLink, LandingWaitlistForm } from "@/app/landing/waitlist-form";
import { turnstileSiteKey, type SignupMode } from "@/lib/account-config";
import { getSessionUser } from "@/lib/auth";
import { currentSignupMode } from "@/lib/console-settings";
import { isDbConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hue Switch Console: Wi-Fi wall switches for Philips Hue",
  description:
    "Set up Wi-Fi wall switches for Philips Hue from your browser and choose what each button does. Free.",
  alternates: { canonical: "/" },
};

const BUTTON = "inline-flex min-h-[46px] items-center rounded-lg px-5 text-[15px] font-medium";
const PRIMARY = `${BUTTON} bg-filament text-filament-ink`;
const SECONDARY = `${BUTTON} border border-line bg-background hover:border-filament`;
const INPUT =
  "min-h-[46px] min-w-0 flex-[1_1_220px] rounded-lg border border-line bg-background px-4 text-[15px] outline-none focus:border-filament";
const H2 = "text-[clamp(26px,3cqi,36px)] font-semibold leading-[1.1] tracking-[-0.025em]";

const COPY: Record<
  SignupMode,
  { primary: string; primaryHref: string; account: string; closingTitle: string; closingText: string }
> = {
  invite: {
    primary: "Join the waitlist",
    primaryHref: "/login",
    account: "Sign-up is by invitation for now. Already invited?",
    closingTitle: "Sign-up is by invitation for now.",
    closingText:
      "Join the waitlist and you get an email when your account is ready. The setup guide is open to everyone.",
  },
  waitlist: {
    primary: "Join the waitlist",
    primaryHref: "/login",
    account: "We let people in in batches while the service runs on free servers. Already have an account?",
    closingTitle: "Join the waitlist, or run your own.",
    closingText:
      "You get an email when there is room for you. The console is open source, so you can also host your own, and the setup guide is open to everyone.",
  },
  open: {
    primary: "Create an account",
    primaryHref: "/login",
    account: "Free. Already have an account?",
    closingTitle: "Make an account and plug in a board.",
    closingText: "It is free. The setup guide walks through the wiring and the first install.",
  },
  closed: {
    primary: "Read the setup guide",
    primaryHref: "/how-to",
    account: "New accounts are not open yet. Already have one?",
    closingTitle: "New accounts are not open yet.",
    closingText: "The setup guide and the firmware source are open to everyone.",
  },
};

const REPO_URL = "https://github.com/tineira/hue-switch-console";

function RepoLink({ children }: { children: ReactNode }) {
  return (
    <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-filament hover:underline">
      {children}
    </a>
  );
}

// The first "open source" in a mode's closing text links to the repo.
function withRepoLink(text: string): ReactNode {
  const i = text.indexOf("open source");
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <RepoLink>open source</RepoLink>
      {text.slice(i + "open source".length)}
    </>
  );
}

const FACTS: { title: string; text: ReactNode }[] = [
  {
    title: "Runs on your home network",
    text: "Presses go from the switch to your Hue Bridge. The console only stores settings; switches keep working if it is down.",
  },
  {
    title: "Wi-Fi stays on the switch",
    text: "Your Wi-Fi password goes from the browser to the switch over USB and never reaches the console.",
  },
  {
    title: "Free, no tracking",
    text: "No ads and no analytics. Sponsorship does not unlock anything.",
  },
  {
    title: "Open source",
    text: (
      <>
        The console is AGPL-3.0 and the firmware is MIT. <RepoLink>Read it, fork it, host your own ↗</RepoLink>
      </>
    ),
  },
];

const ROUND_PARTS: Part[] = [
  {
    name: "Round Display for XIAO",
    text: "1.28″ round touch screen, 240 × 240, on a 39 mm board. The XIAO plugs into the sockets on its back.",
    href: "https://www.seeedstudio.com/Seeed-Studio-Round-Display-for-XIAO-p-5638.html",
  },
  {
    name: "XIAO ESP32-S3",
    text: "21 × 17.8 mm, Wi-Fi and Bluetooth. Its USB-C port is how you install the firmware.",
    href: "https://www.seeedstudio.com/XIAO-ESP32S3-p-5627.html",
  },
  {
    name: "2.4 GHz antenna",
    text: "Comes with the XIAO. Plug it in: without it the screen says “No Wi-Fi”.",
  },
];

const SIMPLE_PARTS: Part[] = [
  {
    name: "XIAO ESP32-C6",
    text: "21 × 17.5 mm. Up to seven wall switches or push buttons: D0 to D5, plus the BOOT button on the board.",
    href: "https://www.seeedstudio.com/Seeed-Studio-XIAO-ESP32C6-p-5884.html",
  },
  {
    name: "The switches already in your wall",
    text: "Toggle switches or push buttons, plus a few wires. The build guide shows what to buy and how to wire them.",
    href: "/how-to?product=simple&topic=build&level=box",
    linkLabel: "Build guide →",
  },
];

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

function StepVisual({ index }: { index: number }) {
  const box = "flex h-[180px] items-center justify-center rounded-2xl border border-line bg-cream";
  if (index === 0) {
    return (
      <div className={`${box} gap-7`}>
        <StateVisual visual={{ face: "wifi" }} label="Round screen: Wi-Fi..." size={112} version={null} />
        <div className="flex flex-col gap-1.5 font-mono text-[11px] text-muted">
          <span>USB-C</span>
          <span>Chrome · Edge</span>
          <span>Web Serial</span>
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className={box}>
        <StateVisual visual={{ face: "pairing" }} label="Round screen: Press Bridge button" size={124} version={null} />
      </div>
    );
  }
  const row = "flex justify-between gap-2 px-3 py-2";
  return (
    <div className={`${box} px-5`}>
      <div className="w-full max-w-[260px] rounded-[10px] border border-line bg-background font-mono text-xs">
        <div className="flex justify-between border-b border-line px-3 py-[9px]">
          <span>Page 1 · Living</span>
        </div>
        <div className={row}>
          <span className="text-muted">tap</span>
          <span>on / off</span>
        </div>
        <div className={`${row} border-t border-line`}>
          <span className="text-muted">double tap</span>
          <span>Sunset, Aurora</span>
        </div>
        <div className={`${row} border-t border-line`}>
          <span className="text-muted">ring</span>
          <span>dim</span>
        </div>
      </div>
    </div>
  );
}

// Signed-out visitors see what the console is (public, for Google's brand review too).
// Signed-in users go straight to their switches.
export default async function Home() {
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/switches");

  const mode = await currentSignupMode();
  const copy = COPY[mode];
  // Invite and waitlist modes take the address right here instead of sending people to /login.
  const waitlistForm = (mode === "invite" || mode === "waitlist") && isDbConfigured();
  const hero = (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">Open source · For Philips Hue</p>
      <h1 className="text-balance text-[clamp(40px,5.2cqi,64px)] font-semibold leading-none tracking-[-0.035em]">
        Build a wall switch for your Hue lights.
      </h1>
      <p className="max-w-[34em] text-pretty text-[clamp(16px,1.5cqi,18px)] leading-[1.55] text-muted">
        Flash a Seeed Studio XIAO from Chrome or Edge, pair it with your Hue Bridge, and choose what each button
        does. Presses go straight to the Bridge on your home network.
      </p>
      {waitlistForm ? (
        <LandingWaitlistForm
          turnstileSiteKey={turnstileSiteKey()}
          inputClassName={INPUT}
          buttonClassName={`${PRIMARY} disabled:opacity-60`}
        />
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <Link href={copy.primaryHref} className={PRIMARY}>
            {copy.primary}
          </Link>
          {mode === "closed" ? null : (
            <Link href="/how-to" className={SECONDARY}>
              Read the setup guide
            </Link>
          )}
        </div>
      )}
      <p className="text-sm text-muted">
        {copy.account}{" "}
        <Link href="/login" className="text-foreground underline underline-offset-[3px]">
          Sign in
        </Link>
      </p>
      {waitlistForm ? (
        <Link href="/how-to" className="text-[15px] font-medium text-filament hover:underline">
          Read the setup guide →
        </Link>
      ) : null}
    </>
  );

  return (
    <div className="@container flex w-full flex-1 flex-col">
      <main className="mx-auto box-border flex w-full max-w-[1200px] flex-col gap-[clamp(56px,8cqi,104px)] px-[clamp(18px,4cqi,48px)]">
        <div>
          <header className="flex items-center gap-2 pt-5">
            <Link href="/" className="mr-auto flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="box-border block h-[18px] w-[18px] rotate-45 rounded-full border-2 border-filament border-b-transparent"
              />
              <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em]">Hue Switch Console</span>
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              title="GitHub"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-cream hover:border-filament"
            >
              <GitHubMark className="h-[18px] w-[18px]" />
            </a>
            <ThemeToggle />
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg border border-line bg-background px-3.5 text-sm font-medium hover:border-filament"
            >
              Sign in
            </Link>
          </header>
          <RoundTrack hero={hero} parts={ROUND_PARTS} />
        </div>

        <SimpleCard parts={SIMPLE_PARTS} />

        <section
          aria-label="Why it works this way"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] border-y border-line"
        >
          {FACTS.map((fact) => (
            <div key={fact.title} className="flex flex-col gap-1.5 py-[22px] pr-5">
              <h2 className="text-[15px] font-semibold">{fact.title}</h2>
              <p className="text-pretty text-sm leading-normal text-muted">{fact.text}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className={H2}>From USB to wall in three steps</h2>
            <Link href="/how-to" className="text-[15px] font-medium text-filament hover:underline">
              Full setup guide →
            </Link>
          </div>
          <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3.5">
                <StepVisual index={i} />
                <span className="font-mono text-xs text-filament">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-pretty text-[15px] leading-normal text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-line bg-cream p-[clamp(24px,4cqi,44px)]">
          <div className="flex flex-[1_1_320px] flex-col gap-2">
            <h2 className="text-[clamp(24px,2.6cqi,32px)] font-semibold leading-[1.15] tracking-[-0.02em]">
              {copy.closingTitle}
            </h2>
            <p className="text-[15px] leading-normal text-muted">{withRepoLink(copy.closingText)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {waitlistForm ? (
              <JoinWaitlistLink className={PRIMARY} />
            ) : (
              <Link href={copy.primaryHref} className={PRIMARY}>
                {copy.primary}
              </Link>
            )}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`${SECONDARY} gap-2`}>
              <GitHubMark className="h-[18px] w-[18px]" />
              Source on GitHub
            </a>
            <Link
              href="/privacy"
              className="inline-flex min-h-[46px] items-center px-2 text-[15px] text-muted underline underline-offset-[3px] hover:text-foreground"
            >
              Privacy
            </Link>
          </div>
        </section>

        <p className="mb-8 max-w-[52em] text-xs leading-normal text-muted">
          Philips Hue is a trademark of Signify. This project is independent and is not affiliated with, endorsed by
          or sponsored by Signify. XIAO is a trademark of Seeed Studio.
        </p>
      </main>
    </div>
  );
}
