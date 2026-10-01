import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LegalFrame, LegalSection } from "@/app/legal-parts";
import { isHostedConsole } from "@/lib/account-config";
import { operatorTermsUrl, TERMS_UPDATED } from "@/lib/terms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms",
  description: "The terms for using Hue Switch Console at hue.tineira.com.",
  alternates: { canonical: "/terms" },
};

const CONTACT = "privacy@tineira.com";

const LINK = "underline underline-offset-4";

// The hosted console's Terms of Use. A self-hosted console sends /terms to its operator's
// TERMS_URL, or has none (docs/specs/terms-and-safety.md §2.1, §2.6.2).
export default function TermsPage() {
  if (!isHostedConsole()) {
    const url = operatorTermsUrl();
    if (url) redirect(url);
    notFound();
  }

  return (
    <LegalFrame>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Use</h1>
        <p className="text-sm text-muted">Last updated {TERMS_UPDATED}.</p>
      </header>
      <LegalSection title="1. Who we are">
        <p>
          Hue Switch Console at hue.tineira.com is a free, non-commercial service run by Tomas Neira, an
          individual, from Chile. Contact:{" "}
          <a href={`mailto:${CONTACT}`} className={LINK}>
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title="2. Accepting these terms">
        <p>
          You accept these Terms and the{" "}
          <Link href="/safety" className={LINK}>
            Safety notice
          </Link>{" "}
          when you create an account. You must be at least 18. If you do not accept them, do not use the
          console.
        </p>
      </LegalSection>
      <LegalSection title="3. What the service is">
        <p>
          The console lets you set up Wi-Fi switches you build yourself for Philips Hue, and install firmware
          on them. It is a hobby project. It is not made, endorsed or supported by Signify or Philips Hue.
        </p>
      </LegalSection>
      <LegalSection title="4. Hardware and safety">
        <p>
          The console does not sell hardware. The designs, guides and firmware are community open source,
          uncertified and in part unproven. You decide whether and how to build and install them, and you are
          responsible for following the electrical rules where you live. The Safety notice is part of these
          Terms.
        </p>
      </LegalSection>
      <LegalSection title="5. Your account">
        <p>
          Keep your sign-in secure. Use the console only for your own switches and Bridges. Do not try to
          break, overload or misuse the service or other people&apos;s accounts. We may suspend or close an
          account that does.
        </p>
      </LegalSection>
      <LegalSection title="6. No warranty">
        <p>
          The service, firmware, designs and guides are provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranty of any kind, express or implied, including fitness for a
          particular purpose and non-infringement. The service may change, be unavailable, or stop at any
          time. Firmware updates may change how a switch behaves.
        </p>
      </LegalSection>
      <LegalSection title="7. Limitation of liability">
        <p>
          As far as the law where you live allows, Tomas Neira and the project&apos;s contributors are not
          liable for any damage, injury, loss or cost arising from building, installing or using anything
          from this project, or from using the console. Nothing in these Terms limits liability that cannot
          be limited by law, such as liability for death or personal injury caused by negligence where the
          law forbids that limit, or your rights as a consumer.
        </p>
      </LegalSection>
      <LegalSection title="8. Open-source licenses">
        <p>
          The console&apos;s source is AGPL-3.0-only, and the firmware is MIT. The hardware designs are
          CERN-OHL-P-2.0. Those licenses govern the code and designs; these Terms govern this hosted service.
        </p>
      </LegalSection>
      <LegalSection title="9. Changes">
        <p>
          We may update these Terms or the Safety notice. For a material change, the console asks you to
          accept the new version before you continue. Switches already installed keep working in the
          meantime.
        </p>
      </LegalSection>
      <LegalSection title="10. Ending">
        <p>
          You can delete your account at any time from{" "}
          <Link href="/account" className={LINK}>
            Account
          </Link>
          . We may end the service with reasonable notice where possible.
        </p>
      </LegalSection>
      <LegalSection title="11. Law">
        <p>
          These Terms are governed by the laws of Chile, without taking away protections the law of your own
          country gives you as a consumer.
        </p>
      </LegalSection>
    </LegalFrame>
  );
}
