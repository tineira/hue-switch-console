import { listSnapshots } from "@/lib/store";

export const dynamic = "force-dynamic";

function formatCaps(caps?: string[]): string {
  if (!caps?.length) {
    return "—";
  }
  return caps.join(", ");
}

export default async function Home() {
  const snapshots = await listSnapshots();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-zinc-500">hue-switch-console</p>
        <h1 className="text-2xl font-semibold tracking-tight">Topología Hue</h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Snapshot que sube un switch (o un curl desde la LAN). Vercel no habla
          con el Bridge; solo guarda lo que llega a{" "}
          <code className="font-mono text-xs">POST /api/ingest</code>.
        </p>
      </header>

      {snapshots.length === 0 ? (
        <section className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Todavía no hay datos. Desde el PC en la misma red que el Bridge:
          <pre className="mt-3 overflow-x-auto rounded-md bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
            npm run push-from-bridge
          </pre>
        </section>
      ) : (
        snapshots.map((snap) => (
          <section key={snap.bridgeid} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <h2 className="text-lg font-medium">{snap.bridgeid}</h2>
              {snap.bridgeIp ? (
                <span className="font-mono text-zinc-500">{snap.bridgeIp}</span>
              ) : null}
              <span className="text-zinc-500">
                {snap.lights.length} luces
                {snap.rooms.length ? ` · ${snap.rooms.length} rooms` : ""}
              </span>
              <span className="text-zinc-400">
                {snap.source} · {new Date(snap.receivedAt).toLocaleString()}
              </span>
            </div>

            {snap.rooms.length > 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {snap.rooms.map((room) => room.name).join(" · ")}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nombre</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Caps</th>
                    <th className="px-3 py-2 font-medium">id</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.lights.map((light) => (
                    <tr
                      key={light.id}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="px-3 py-2">{light.name}</td>
                      <td className="px-3 py-2">
                        {light.on === undefined ? "—" : light.on ? "on" : "off"}
                      </td>
                      <td className="px-3 py-2 text-zinc-500">
                        {formatCaps(light.caps)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                        {light.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </main>
  );
}
