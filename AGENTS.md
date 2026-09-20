<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# hue-switch-console

Vercel/Next.js commissioning UI. Not the Arduino firmware (`hue-simple-switch`).

- Product UI is **English** (labels, errors, auth emails). Spec in `docs/definiciones.md` may stay Spanish.
- Topology arrives from the LAN (switch or `push-from-bridge`); this app never calls the Hue Bridge.
- Secrets stay in `.env.local` — never commit it.
- Do not mix this tree with `C:\Users\tinei\Arduino`.
- Read `docs/definiciones.md` before implementing.
