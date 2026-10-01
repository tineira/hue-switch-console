import Link from "next/link";
import { LegalFrame, LegalSection } from "@/app/legal-parts";
import { SafetyPoints } from "@/app/safety/safety-points";
import { DESIGN_STATUS_LABEL, DESIGN_STATUS_TEXT, type DesignStatus } from "@/lib/how-to-build";
import { SAFETY_UPDATED } from "@/lib/terms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Safety",
  description: "Read this before you build a switch: mains danger, uncertified and unproven designs, local rules.",
  alternates: { canonical: "/safety" },
};

// The designs' maintainer, on every console: a design problem is theirs, not the operator's.
const CONTACT = "privacy@tineira.com";
const STATUSES: DesignStatus[] = ["experimental", "maintainer", "community"];

// Public, on every console: it is about the designs, not the operator
// (docs/specs/terms-and-safety.md §2.1, §2.6.1).
export default function SafetyPage() {
  return (
    <LegalFrame>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Safety notice</h1>
        <p className="text-sm text-muted">Last updated {SAFETY_UPDATED}.</p>
      </header>
      <div className="flex flex-col gap-3 rounded-xl border border-danger/50 bg-danger-soft p-4">
        <p className="font-semibold text-danger">Read this before you build anything from this project.</p>
        <SafetyPoints />
        <p className="text-sm text-muted">If you are unsure about any step, stop and ask a qualified electrician.</p>
      </div>
      <LegalSection id="status" title="Design status">
        <p>
          Each build guide on <Link href="/how-to" className="underline underline-offset-4">How-to</Link> shows
          how proven its design is.
        </p>
        <ul className="flex flex-col gap-1.5">
          {STATUSES.map((s) => (
            <li key={s}>
              <strong className="font-medium">{DESIGN_STATUS_LABEL[s]}.</strong> {DESIGN_STATUS_TEXT[s]}
            </li>
          ))}
        </ul>
      </LegalSection>
      <LegalSection title="If something goes wrong">
        <p>
          Switch the circuit off at the breaker. Do not touch the switch, the board or any wire. Call an
          electrician, or emergency services if anyone is hurt or something is burning.
        </p>
      </LegalSection>
      <LegalSection title="Report a design problem">
        <p>
          Open an issue on{" "}
          <a
            href="https://github.com/tineira/hue-simple-switch/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            GitHub
          </a>
          . For anything that could hurt someone, also write to{" "}
          <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalFrame>
  );
}
