import { KeysPanel } from "@/app/keys/keys-panel";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { listApiKeys, toApiKeyPublic } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const user = await requireSessionUser();
  const keys = await listApiKeys(user.id);

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Device API keys</h1>
        <p className="max-w-2xl text-sm text-muted">
          A switch uses this token as{" "}
          <code className="font-mono text-xs">CONSOLE_TOKEN</code> in{" "}
          <code className="font-mono text-xs">Authorization: Bearer</code>. It
          is not a Hue application key and it cannot sign in to this page. The
          secret is shown once. Postgres stores only the SHA-256 hash, name, and
          prefix.
        </p>
      </section>
      <KeysPanel initialKeys={keys.map(toApiKeyPublic)} />
    </Shell>
  );
}
