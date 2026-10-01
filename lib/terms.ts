import { isHostedConsole } from "@/lib/account-config";
import { sql } from "@/lib/sql";

// The Safety notice and Terms of Use, and who has accepted which version
// (docs/specs/terms-and-safety.md §2.2–§2.4).

export type TermsDocument = "safety" | "terms";

/** A material change bumps the date; a typo fix does not. Each page shows it as "Last updated". */
export const SAFETY_VERSION = "2026-10-01";
const HOSTED_TERMS_VERSION = "2026-10-01";

/** Shown on the pages as "Last updated …". */
export const SAFETY_UPDATED = "October 1, 2026";
export const TERMS_UPDATED = "October 1, 2026";

/** A self-hosted operator's own Terms, when they have any. */
export function operatorTermsUrl(): string | null {
  if (isHostedConsole()) return null;
  return process.env.TERMS_URL?.trim() || null;
}

/** True when this console has Terms to accept: the hosted text, or the operator's TERMS_URL. */
export function hasTerms(): boolean {
  return isHostedConsole() || operatorTermsUrl() !== null;
}

/** The Terms version in force. An operator who edits their TERMS_URL text bumps TERMS_VERSION. */
export function termsVersion(): string {
  if (isHostedConsole()) return HOSTED_TERMS_VERSION;
  return process.env.TERMS_VERSION?.trim() || HOSTED_TERMS_VERSION;
}

/** Every document this console asks for, with its current version. Safety is on every console. */
export function requiredDocuments(): { document: TermsDocument; version: string }[] {
  const docs: { document: TermsDocument; version: string }[] = [
    { document: "safety", version: SAFETY_VERSION },
  ];
  if (hasTerms()) docs.push({ document: "terms", version: termsVersion() });
  return docs;
}

/** The documents whose current version this account has not accepted yet. */
export async function pendingDocuments(userId: string): Promise<TermsDocument[]> {
  const rows = (await sql()`
    select document, version from terms_acceptances where user_id = ${userId}
  `) as { document: string; version: string }[];
  const accepted = new Set(rows.map((r) => `${r.document}:${r.version}`));
  return requiredDocuments()
    .filter((d) => !accepted.has(`${d.document}:${d.version}`))
    .map((d) => d.document);
}

/** Records acceptance of the current version of each document. Accepting twice is a no-op. */
export async function recordAcceptance(userId: string, documents: TermsDocument[]) {
  const db = sql();
  for (const d of requiredDocuments()) {
    if (!documents.includes(d.document)) continue;
    await db`
      insert into terms_acceptances (user_id, document, version)
      values (${userId}, ${d.document}, ${d.version})
      on conflict do nothing
    `;
  }
}

/** The latest accepted version of each document per account, for the admin Accounts tab. */
export async function acceptedVersions(
  userIds: string[],
): Promise<Map<string, Partial<Record<TermsDocument, string>>>> {
  const out = new Map<string, Partial<Record<TermsDocument, string>>>();
  if (userIds.length === 0) return out;
  const rows = (await sql()`
    select user_id, document, max(version) as version
    from terms_acceptances
    where user_id = any(${userIds}::uuid[])
    group by user_id, document
  `) as { user_id: string; document: TermsDocument; version: string }[];
  for (const r of rows) {
    const entry = out.get(r.user_id) ?? {};
    entry[r.document] = r.version;
    out.set(r.user_id, entry);
  }
  return out;
}
