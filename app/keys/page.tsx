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
          Each switch uses a key to talk to this console. Setup gives every
          board its own, so come here to see which board uses which key and to
          revoke the ones nothing uses.
        </p>
      </section>
      <KeysPanel initialKeys={keys.map(toApiKeyPublic)} />
    </Shell>
  );
}
