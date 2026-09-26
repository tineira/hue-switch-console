import Link from "next/link";
import { Shell } from "@/app/shell";
import { ThemePicker } from "@/app/theme-picker";
import { getSessionUser } from "@/lib/auth";
import { CONSOLE_CREDITS, THANKS } from "@/lib/credits";
import { ensureSchema } from "@/lib/ensure-schema";
import { isDbConfigured } from "@/lib/env";
import { currentCredits, type CreditEntry, type CurrentCredits } from "@/lib/firmware";
import type { ProductId } from "@/lib/web-setup/products";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Credits",
};

const FIRMWARE: { product: ProductId; title: string }[] = [
  { product: "round", title: "Round firmware" },
  { product: "simple", title: "Simple firmware" },
];

async function loadFirmwareCredits(product: ProductId): Promise<CurrentCredits | null> {
  if (!isDbConfigured()) return null;
  return ensureSchema()
    .then(() => currentCredits(product))
    .catch(() => null);
}

function CreditTable({ entries }: { entries: CreditEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-cream text-xs text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Version</th>
            <th className="px-3 py-2 font-medium">License</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.name} className="border-t border-line">
              <td className="px-3 py-2">
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-filament hover:underline"
                >
                  {entry.name}
                </a>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{entry.version}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{entry.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-8 flex-col gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

async function CreditsContent() {
  const firmware = await Promise.all(
    FIRMWARE.map(async (item) => ({ ...item, current: await loadFirmwareCredits(item.product) })),
  );

  return (
    <>
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="max-w-2xl text-sm text-muted">
          The console and the switch firmware stand on services, hardware and open-source software
          made by other people. Thank you.
        </p>
      </section>

      <Section id="thanks" title="Thanks">
        <ul className="grid gap-3 sm:grid-cols-2">
          {THANKS.map((item) => (
            <li key={item.name} className="rounded-xl border border-line bg-cream p-4">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-filament hover:underline"
              >
                {item.name}
              </a>
              <p className="mt-1 text-sm text-muted">{item.role}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="console" title="Console open source">
        <CreditTable entries={CONSOLE_CREDITS} />
      </Section>

      {firmware.map(({ product, title, current }) => (
        <Section
          key={product}
          id={product}
          title={
            <>
              {title}
              {current ? <span className="ml-2 font-mono text-sm text-muted">{current.version}</span> : null}
            </>
          }
        >
          {current?.credits ? (
            <CreditTable entries={current.credits} />
          ) : (
            <p className="text-sm text-muted">Credits arrive with the next firmware release.</p>
          )}
        </Section>
      ))}

      <Section id="trademarks" title="Trademarks">
        <p className="max-w-2xl text-sm text-muted">
          Philips Hue is a trademark of Signify. This project is independent and is not affiliated
          with, endorsed by or sponsored by Signify. XIAO is a trademark of Seeed Studio. Other names
          belong to their owners.
        </p>
      </Section>
    </>
  );
}

// Public: no sign-in needed (docs/specs/credits.md §2.2).
export default async function CreditsPage() {
  const user = await getSessionUser().catch(() => null);

  if (user) {
    return (
      <Shell email={user.email}>
        <CreditsContent />
      </Shell>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Hue switch console
        </Link>
        <ThemePicker />
      </div>
      <CreditsContent />
    </main>
  );
}
