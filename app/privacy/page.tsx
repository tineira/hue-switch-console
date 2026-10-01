import { PublicFrame } from "@/app/public-frame";
import { Shell } from "@/app/shell";
import { isHostedConsole } from "@/lib/account-config";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy",
  description: "What Hue Switch Console stores, why, who helps run it, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "September 30, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

// Only on hue.tineira.com's own policy. Cloudflare Email Routing forwards privacy@ to the operator.
const HOSTED_CONTACT = "privacy@tineira.com";

function Contact() {
  const email = process.env.CONTACT_EMAIL || HOSTED_CONTACT;
  return (
    <>
      <a href={`mailto:${email}`} className="underline underline-offset-4">
        {email}
      </a>{" "}
      or{" "}
      <a
        href="https://x.com/tomneira"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4"
      >
        @tomneira on X
      </a>
    </>
  );
}

function PrivacyContent() {
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted">Last updated {UPDATED}.</p>
        <p className="text-sm text-muted">
          Hue Switch Console is a free service run by Tomas Neira at hue.tineira.com. It lets you
          set up Wi-Fi wall switches for Philips Hue and decide what each button does. This page
          says what the console stores, why, who helps run it, and how to delete it. The console
          has no ads, no analytics and no tracking, and nothing is sold or shared for marketing.
        </p>
      </header>

      <Section title="What the console stores">
        <p>
          <strong>Your account.</strong> Your email address. If you sign in with Google or GitHub,
          also the name and profile picture they share, and the sign-in tokens they return. The
          console doesn&apos;t use those tokens for anything and stores them encrypted. When you
          created the account and when you last signed in. When you accept the Terms and the
          Safety notice, which version you accepted and when.
        </p>
        <p>
          <strong>No passwords.</strong> You never set a password here: you sign in with Google,
          GitHub or a 6-digit code emailed to you. Codes are stored only as a one-way hash. Each
          works once, and an unused code expires after 10 minutes.
        </p>
        <p>
          <strong>Your sessions.</strong> For each device you are signed in on: the IP address and
          browser name it signed in from, and when the session expires (after 7 days without use).
        </p>
        <p>
          <strong>Your switches and Bridges.</strong> What your switches send when they check in:
          each switch&apos;s hardware address (MAC), firmware version and label, and your Hue
          Bridge&apos;s id, local IP address and its list of rooms, zones, lights and scenes with
          their names. Also what you set up in the console (pages, buttons, scenes) and when each
          switch last checked in. The key your switch uses to talk to your Hue Bridge stays on the
          switch; the console never receives it and never talks to your Bridge.
        </p>
        <p>
          <strong>Device API keys.</strong> The name you gave each key and a one-way hash of it.
          The key itself is shown to you once and not kept.
        </p>
        <p>
          <strong>Sign-in safety records.</strong> When a sign-in code is sent or a wrong code is
          entered: the email address, IP address and time. These limit abuse and are deleted
          after 7 days.
        </p>
        <p>
          <strong>Waitlist.</strong> If you join the waitlist: your email and the date. It is kept
          while you wait, then for 90 days after you get your invite, leave the waitlist, or are
          removed from it. The email saying you&apos;re on the list has a link to leave. If
          Resend tells us an email to you bounced or was marked as spam, the address comes off
          the waitlist; that notice is kept for 30 days.
        </p>
      </Section>

      <Section title="Your Wi-Fi name and password">
        <p>
          On <strong>Setup</strong> you type your Wi-Fi network name and password so the switch
          can join your network. They go from your browser straight to the switch over the USB
          cable and are saved on the switch. They are <strong>never sent to the console</strong>:
          not stored in its database, not in its logs, and not in the USB debug panel on Setup.
          When Setup reads a connected switch, it shows the network name the switch reports over
          USB; that also stays in your browser.
        </p>
        <p>
          The switch keeps them in its own memory, like any Wi-Fi device. Before giving a switch
          away, plug it in on Setup and click <strong>Erase settings</strong> (under Reset
          board): the switch forgets your Wi-Fi name and password, its link to the console and to
          your Hue Bridge, and its button settings. If a switch is lost, change your Wi-Fi
          password.
        </p>
      </Section>

      <Section title="Why">
        <p>
          Only to run the service: to sign you in, keep your account secure, send your switches
          their settings, show you your home&apos;s rooms and lights, and send the emails you ask
          for (sign-in codes, waitlist updates, invites, and a notice when your email changes). The admin page shows
          the operator counts per account (switches, Bridges, last sign-in), never your rooms,
          lights or button settings.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          One cookie keeps you signed in. A second, short-lived cookie (one hour) holds an invite
          code while you sign up. Your browser also remembers your theme and which switch model
          the How-to page shows; that stays on your device. The email sign-in and waitlist forms
          use Cloudflare Turnstile to tell people from bots, which runs a check in your browser.
          It loads only once you start filling in one of those forms, not when you sign in with
          Google or GitHub.
        </p>
      </Section>

      <Section title="Who helps run it">
        <p>These companies process data for the console, each for its part only:</p>
        <ul className="list-disc pl-5">
          <li>Vercel: hosting (United States). Keeps request logs for a short time.</li>
          <li>Neon: the database (United States, AWS us-east-1).</li>
          <li>Resend: sends the console&apos;s emails (United States).</li>
          <li>Cloudflare: DNS for hue.tineira.com and the Turnstile bot check.</li>
          <li>Google and GitHub: only if you choose to sign in with them.</li>
        </ul>
      </Section>

      <Section title="How long it is kept, and deleting it">
        <p>
          Your data stays until you delete your account. On the <strong>Account</strong> page you
          can change your email, sign out everywhere, or delete your account. Deleting removes
          your account, sign-in methods, sessions, API keys, Bridges, switches and settings from
          the database at once. The database keeps a rolling 6-hour history for recovery, so
          deleted data is gone from it within 6 hours. Your switches keep their saved settings on
          the device until you reset them; they can no longer reach the console.
        </p>
        <p>
          The operator can also delete an account, for example one that has had no switch and no
          sign-in for a long time. Accounts are never deleted automatically.
        </p>
      </Section>

      <Section title="Questions and requests">
        <p>
          To ask what is stored about you, to get a copy, or to have something corrected or
          deleted, contact <Contact />.
        </p>
        <p>
          If this page changes in a way that matters, the new version is posted here with a new
          date.
        </p>
      </Section>
    </article>
  );
}

// A self-hosted console: the hosted text would name the wrong operator and services
// (docs/specs/self-hosting.md §5 decision 5).
function SelfHostedPrivacy() {
  const email = process.env.CONTACT_EMAIL?.trim();
  const policy = process.env.PRIVACY_URL?.trim();
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted">
          This console is run by its owner, not by the Hue Switch Console project. Their privacy
          policy applies; ask them what they keep and for how long.
          {policy ? (
            <>
              {" "}
              <a href={policy} className="underline underline-offset-4">
                Read their policy
              </a>
              .
            </>
          ) : null}
          {email ? (
            <>
              {" "}
              Contact:{" "}
              <a href={`mailto:${email}`} className="underline underline-offset-4">
                {email}
              </a>
              .
            </>
          ) : null}
        </p>
      </header>
      <Section title="What the software stores">
        <p>
          The console software keeps your account (email address, sign-in method, sessions, and
          which version of the Safety notice and Terms you accepted), your API keys, and what your switches send when they check in: each switch&apos;s
          hardware address, firmware version and settings, and your Hue Bridge&apos;s rooms,
          zones, lights and scenes. It has no ads, analytics or tracking built in.
        </p>
        <p>
          It is free software; the{" "}
          <a
            href="https://github.com/tineira/hue-switch-console"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            source
          </a>{" "}
          shows exactly what it stores. The owner of this console may have changed it.
        </p>
      </Section>
    </article>
  );
}

// Public: no sign-in needed. Linked from /login and the footer (docs/specs/finished/multi-user-accounts.md §2.12).
export default async function PrivacyPage() {
  const user = await getSessionUser({ allowPending: true }).catch(() => null);
  const content = isHostedConsole() ? <PrivacyContent /> : <SelfHostedPrivacy />;

  if (user) {
    return (
      <Shell email={user.email}>
        {content}
      </Shell>
    );
  }

  return (
    <PublicFrame>
      {content}
    </PublicFrame>
  );
}
