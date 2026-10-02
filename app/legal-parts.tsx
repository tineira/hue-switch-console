import { PublicFrame } from "@/app/public-frame";
import { Shell } from "@/app/shell";
import { getSessionUser } from "@/lib/auth";

// Shared by /safety and /terms (docs/specs/finished/terms-and-safety.md §2.1).

export function LegalSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/** Public: Shell for a signed-in person (even one who still has to accept), else PublicFrame. */
export async function LegalFrame({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser({ allowPending: true }).catch(() => null);
  const body = <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">{children}</article>;
  if (user) return <Shell email={user.email}>{body}</Shell>;
  return <PublicFrame>{body}</PublicFrame>;
}
