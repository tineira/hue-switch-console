import { KeysPanel } from "@/app/keys/keys-panel";
import { Shell } from "@/app/shell";
import { requireSessionUser } from "@/lib/auth";
import { listApiKeys, toApiKeyPublic } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "API keys",
};

export default async function KeysPage() {
  const user = await requireSessionUser();
  const keys = await listApiKeys(user.id);

  return (
    <Shell email={user.email}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="max-w-2xl text-sm text-muted">
          Keys let a switch talk to this console. Devices creates one for each
          board, so you only need this page to revoke a key or to make one for
          a developer build. A new key is shown once.
        </p>
      </section>
      <KeysPanel initialKeys={keys.map(toApiKeyPublic)} />
    </Shell>
  );
}
