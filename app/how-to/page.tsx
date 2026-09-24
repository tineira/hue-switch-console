import Link from "next/link";
import type { ReactNode } from "react";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import roundManifest from "@/public/firmware/round/manifest.json";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "How-to",
};

const LINK = "text-filament underline underline-offset-2";

// Blink timings live in globals.css (.led-*) and mirror led.h in hue-simple-switch.
type Pattern = "fast" | "burst-2" | "burst-3" | "burst-4" | "heart" | "solid";

// Ring colours and pulses live in globals.css (.round-face-*) and mirror ui.h in hue-round-switch.
type Ring = "wait" | "loading" | "pairing" | "error" | "mute" | "ready";

type Fix = { text: string; href?: string; link?: string };

type Step = {
  key: string;
  see: string;
  state: string;
  means: string;
  fix?: Fix;
  ready?: boolean;
};

const SIMPLE_STEPS: (Step & { pattern: Pattern })[] = [
  {
    key: "fast",
    pattern: "fast",
    see: "Fast blink, no pause",
    state: "No Wi-Fi",
    means: "The board is not on Wi-Fi.",
    fix: { text: "Connect the board over USB and save Wi-Fi on", href: "/devices", link: "Devices" },
  },
  {
    key: "burst-2",
    pattern: "burst-2",
    see: "Two blinks, then a pause",
    state: "Needs console",
    means: "Wi-Fi is up. The console address or the device token is missing.",
    fix: { text: "Save a token on", href: "/devices", link: "Devices" },
  },
  {
    key: "burst-3",
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
    key: "burst-4",
    pattern: "burst-4",
    see: "Four blinks, then a pause",
    state: "Needs a recipe",
    means: "The Bridge is paired, and no recipes are saved.",
    fix: { text: "Save at least one recipe on", href: "/", link: "Bridge" },
  },
  {
    key: "heart",
    pattern: "heart",
    see: "One short blink about every 3 seconds",
    state: "Ready",
    means:
      "Wi-Fi, the console, the Bridge, and at least one recipe are set. One recipe on any channel is enough. A press that does not reach the Bridge does not change the pattern.",
    ready: true,
  },
];

const ROUND_STEPS: (Step & { ring: Ring; face: ReactNode })[] = [
  {
    key: "wifi",
    ring: "wait",
    face: <FaceText line="Wi-Fi..." sub={roundManifest.version} />,
    see: "Wi-Fi... and the firmware version",
    state: "Joining Wi-Fi",
    means: "The board is joining the saved network. This usually takes a few seconds.",
  },
  {
    key: "no-wifi",
    ring: "error",
    face: <FaceText line="No Wi-Fi" sub="Plug the antenna" />,
    see: "No Wi-Fi, Plug the antenna",
    state: "No Wi-Fi",
    means:
      "The board could not join Wi-Fi, or no network is saved. The XIAO S3 needs its U.FL antenna to reach the router.",
    fix: {
      text: "Plug in the antenna. If it is already in, save a 2.4 GHz network on",
      href: "/devices",
      link: "Devices",
    },
  },
  {
    key: "loading",
    ring: "loading",
    face: <FaceText line="Loading..." sub="Connecting" />,
    see: "Loading..., Connecting, ring pulses",
    state: "Finding the Bridge",
    means: "Wi-Fi is up. The board is looking for the Hue Bridge on the network.",
  },
  {
    key: "pairing",
    ring: "pairing",
    face: <FaceText line="Press Bridge button" sub="on the Hue Bridge" />,
    see: "Press Bridge button, ring flashes yellow",
    state: "Needs pairing",
    means:
      "The board found the Bridge and is waiting for you to approve it. It also shows this when the Bridge rejects the saved key twice, and then pairs again by itself.",
    fix: {
      text: "Press the round button on top of the Hue Bridge. To pair again later, hold BOOT for about 3 seconds.",
    },
  },
  {
    key: "no-bridge",
    ring: "error",
    face: <FaceText line="No Bridge" sub="same LAN as Bridge" />,
    see: "No Bridge, same LAN as Bridge",
    state: "Bridge not reachable",
    means:
      "The board cannot find the Bridge on this network. It keeps retrying, and after a short Bridge or Wi-Fi outage it reconnects by itself.",
    fix: {
      text: "Check that the Bridge is on and on the same network as the board.",
    },
  },
  {
    key: "empty",
    ring: "mute",
    face: <FaceEmpty />,
    see: "A blank disc that says Page",
    state: "Needs a page",
    means: "The Bridge is paired, and this Round has no pages yet.",
    fix: { text: "Add at least one page on", href: "/", link: "Bridge" },
  },
  {
    key: "ready",
    ring: "ready",
    face: <FaceReady />,
    see: "Page name, scene, brightness ring, page dots",
    state: "Ready",
    means:
      "Tap or double tap runs that page's recipes, swipe changes page, and the ring dims. The disc shows ... while a press is sent. After the screen timeout the disc goes dark. The first touch only wakes it.",
    ready: true,
  },
];

function Led({ pattern, label }: { pattern: Pattern; label: string }) {
  return <span role="img" aria-label={label} className={`led led-${pattern}`} />;
}

function Face({
  ring,
  flash,
  label,
  children,
}: {
  ring: Ring;
  flash?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`round-face round-face-${ring}${flash ? " round-face-flash" : ""}`}
    >
      {children}
    </div>
  );
}

function FaceText({ line, sub }: { line: string; sub?: string }) {
  return (
    <>
      <span className="round-face-line">{line}</span>
      {sub ? <span className="round-face-sub">{sub}</span> : null}
    </>
  );
}

function FaceEmpty() {
  return <span className="round-face-name">Page</span>;
}

function FaceReady({ tokenDot }: { tokenDot?: boolean }) {
  return (
    <>
      <span className="round-face-disc" />
      <span className="round-face-name">Living room</span>
      <span className="round-face-sub">Relax</span>
      <span className="round-face-dots">
        <i className="on" />
        <i />
        <i />
      </span>
      {tokenDot ? <span className="round-face-token" /> : null}
    </>
  );
}

function GuideStep({
  n,
  title,
  where,
  href,
  children,
}: {
  n: number;
  title: string;
  where?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-xl border border-line bg-cream p-4">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-filament-soft text-xs font-semibold text-filament tabular-nums">
        {n}
      </span>
      <div className="flex min-w-0 flex-col gap-2 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{title}</span>
          {where && href ? (
            <Link href={href} className={`text-xs ${LINK}`}>
              {where}
            </Link>
          ) : null}
        </p>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-muted marker:text-line [&_b]:font-medium [&_b]:text-foreground">
          {children}
        </ul>
      </div>
    </li>
  );
}

function FixLine({ fix }: { fix: Fix }) {
  return (
    <p className="text-foreground">
      <span className="font-medium">Fix: </span>
      {fix.text}
      {fix.href ? (
        <>
          {" "}
          <Link href={fix.href} className={LINK}>
            {fix.link}
          </Link>
          .
        </>
      ) : null}
    </p>
  );
}

function StateCard({
  step,
  visual,
  index,
  wide,
}: {
  step: Step;
  visual: ReactNode;
  index?: number;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex gap-4 rounded-xl border p-4 ${
        step.ready ? "border-ok/40 bg-ok-soft" : "border-line bg-cream"
      }`}
    >
      <div
        className={`flex shrink-0 flex-col items-center gap-2 pt-1 ${wide ? "w-24" : "w-10"}`}
      >
        {visual}
        {index !== undefined ? (
          <span className="text-xs text-muted tabular-nums">{index}</span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className={`font-semibold ${step.ready ? "text-ok" : "text-foreground"}`}>
            {step.state}
          </span>
          <span className="text-xs text-muted">{step.see}</span>
        </p>
        <p className="text-muted">{step.means}</p>
        {step.fix ? <FixLine fix={step.fix} /> : null}
      </div>
    </div>
  );
}

function ErrorCard({
  visual,
  wide,
  title,
  see,
  children,
}: {
  visual: ReactNode;
  wide?: boolean;
  title: string;
  see: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-danger/50 bg-danger-soft p-4">
      <div className={`flex shrink-0 justify-center pt-1 ${wide ? "w-24" : "w-10"}`}>{visual}</div>
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-danger">{title}</span>
          <span className="text-xs text-muted">{see}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

export default async function HowToPage() {
  const user = await requireSessionUser();

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">How-to</h1>
        <p className="text-sm text-muted">
          Jump to{" "}
          <a href="#console" className={LINK}>
            Using the console
          </a>
          ,{" "}
          <a href="#simple" className={LINK}>
            Simple switch lights
          </a>
          , or{" "}
          <a href="#round" className={LINK}>
            Round switch screens
          </a>
          .
        </p>
      </section>

      <section id="console" className="flex max-w-2xl scroll-mt-6 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Using the console</h2>
          <p className="text-sm text-muted">
            Set up a board once on Devices, then choose what its buttons or
            pages do on Bridge.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          <GuideStep n={1} title="Set up a board" where="Devices" href="/devices">
            <li>
              Plug the board into this computer with a USB-C cable that carries
              data, and use Chrome or Edge.
            </li>
            <li>
              Click <b>Detect device</b> and choose the board&apos;s port in the
              window Chrome opens. On a new Simple switch, hold BOOT while you
              click Install.
            </li>
            <li>
              Follow the <b>Setup</b> checklist. On a new board that means{" "}
              <b>Install</b>, <b>Set up Wi-Fi</b> (a 2.4 GHz network), and{" "}
              <b>Link to console</b>.
            </li>
            <li>
              Right after Detect, Wi-Fi or Console can show amber while the
              board joins the network. The page reads the board again every 10
              seconds, up to three times, and then offers <b>Check again</b>.
            </li>
            <li>
              When the board asks, press the button on top of the Hue Bridge.
              The Round screen says Press Bridge button, and the Simple LED
              blinks three times. <b>Pair with Bridge</b> starts it again if
              you missed it.
            </li>
            <li>
              When the card turns green and says <b>This board is set up</b>,
              unplug it and mount it.
            </li>
            <li>
              The console holds the USB port while a board is detected.{" "}
              <b>Disconnect</b> releases it so Arduino IDE or a serial monitor
              can open it.
            </li>
          </GuideStep>

          <GuideStep n={2} title="Choose what it does" where="Bridge" href="/">
            <li>
              Pick the switch from the tabs at the top. The pencil renames it;
              the name is only used in the console.
            </li>
            <li>
              <b>Simple switch:</b> each button has slots. BOOT has{" "}
              <b>Short press</b>; the wired buttons D0, D1, and D2 have{" "}
              <b>On</b>, <b>Off</b>, and <b>Double-click</b>. Click a slot, then
              click a room, light, or scene under Lights and scenes.{" "}
              <b>Use this room for on and off</b> fills both slots at once. The
              menu on a slot switches between Toggle, Turn on, and Turn off.
            </li>
            <li>
              <b>Round switch:</b> click <b>Add page</b> and pick the page&apos;s
              room or zone. Then select <b>Tap</b> or <b>Double tap</b> and click
              a light or scene on the right. Several scenes make a list that the
              press steps through, up to 8 from the same room.{" "}
              <b>Use this room for tap and double-tap</b> makes tap toggle the
              room and double tap turn it off. The dimmer ring follows the
              page&apos;s lights.
            </li>
            <li>
              For a Round you can also set the page swipe direction, the screen
              timeout, and each page&apos;s name and colours.
            </li>
          </GuideStep>

          <GuideStep n={3} title="Save and check">
            <li>
              Read the <b>Confirmation</b> box, which says in words what each
              press will do, then click <b>Save pages</b> (Round) or{" "}
              <b>Save recipes</b> (Simple).
            </li>
            <li>
              The switch picks up changes the next time it checks in, which can
              take up to an hour. To apply them now, restart the board: unplug it
              and plug it back in.
            </li>
          </GuideStep>

          <GuideStep n={4} title="Keep it up to date">
            <li>
              A switch tab on Bridge says <b>update</b> when newer firmware is
              out. Plug the board in, detect it on Devices, and click{" "}
              <b>Update</b>. Wi-Fi, the console link, and its buttons or pages
              stay.
            </li>
            <li>
              If a board is lost or given away, revoke its key under{" "}
              <b>API keys</b> in the menu under your email. Keys listed under{" "}
              <b>Not in use</b> belong to no board and can go too.
            </li>
          </GuideStep>
        </ol>

        <p className="text-sm text-muted">
          Something not working? The guides below say what the Simple
          switch&apos;s light and the Round switch&apos;s screen mean, and what to
          do about each.
        </p>
      </section>

      <section id="simple" className="flex max-w-2xl scroll-mt-6 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Simple switch · LED status</h2>
          <p className="text-sm text-muted">
            The orange LED on the XIAO shows which setup step the board is on.
            Match the blink, then follow the fix.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {SIMPLE_STEPS.map((step, i) => (
            <li key={step.key}>
              <StateCard
                step={step}
                index={i + 1}
                visual={<Led pattern={step.pattern} label={step.see} />}
              />
            </li>
          ))}
        </ol>

        <ErrorCard visual={<Led pattern="solid" label="Solid on" />} title="Error" see="Solid on">
          <p className="text-muted">
            The console rejected the device token, or the console task on the
            board did not start. This wins over every blink, and losing Wi-Fi
            does not turn it off.
          </p>
          <FixLine
            fix={{ text: "Save a new token on", href: "/devices", link: "Devices" }}
          />
          <p className="text-muted">It clears once the console accepts the board.</p>
        </ErrorCard>

        <p className="text-xs text-muted">
          The red charge LED, BOOT, and RESET are not part of this list.
        </p>
      </section>

      <section id="round" className="flex max-w-2xl scroll-mt-6 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Round switch · Screen status</h2>
          <p className="text-sm text-muted">
            The round display shows which setup step the board is on. Match the
            screen, then follow the fix. Colours on your Round follow its page
            theme.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {ROUND_STEPS.map((step, i) => (
            <li key={step.key}>
              <StateCard
                step={step}
                index={i + 1}
                wide
                visual={
                  <Face ring={step.ring} label={step.see}>
                    {step.face}
                  </Face>
                }
              />
            </li>
          ))}
        </ol>

        <ErrorCard
          wide
          visual={
            <Face ring="ready" label="Ready with a red dot at the bottom">
              <FaceReady tokenDot />
            </Face>
          }
          title="Token rejected"
          see="Red dot at the bottom, stays until fixed"
        >
          <p className="text-muted">
            The console rejected the device token. The switch keeps working
            with the recipes it already has, but it cannot get new ones.
          </p>
          <FixLine fix={{ text: "Save a new token on", href: "/devices", link: "Devices" }} />
        </ErrorCard>

        <ErrorCard
          wide
          visual={
            <Face ring="error" label="Token rejected">
              <FaceText line="Token rejected" sub="Set a new one in Devices" />
            </Face>
          }
          title="Token rejected, no recipes"
          see="Stays until fixed"
        >
          <p className="text-muted">
            The full screen only shows when the console rejected the token and
            this Round has no recipes yet, so presses have nothing to run.
          </p>
          <FixLine fix={{ text: "Save a new token on", href: "/devices", link: "Devices" }} />
        </ErrorCard>

        <ErrorCard
          wide
          visual={
            <Face ring="ready" flash label="Ring flashes red">
              <FaceReady />
            </Face>
          }
          title="Command failed"
          see="Ring flashes red, about 0.7 seconds"
        >
          <p className="text-muted">
            A press did not reach the Bridge. The screen stays on the page and
            shows what the Bridge reports a moment later, so you can tap again
            right away. If it keeps happening, check that the Bridge is on and
            on the same network.
          </p>
        </ErrorCard>
      </section>
    </Shell>
  );
}
