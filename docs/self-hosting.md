# Self-hosting the console

How to run your own Hue Switch Console and set up switches that talk to it instead of `https://hue.tineira.com`. The design and its decisions are in [`specs/self-hosting.md`](specs/self-hosting.md).

A self-hosted console is the same code as the hosted one. You need:

- A Postgres database.
- A place to run a Next.js app: Vercel, or any machine with Node 24 (a home server, a Raspberry Pi 4 or 5).
- An address your switches can reach, and a way to open **Setup** in Chrome or Edge (see [Pick how switches reach the console](#2-pick-how-switches-reach-the-console)).
- Firmware for your switches: imported from the hosted console, or built by your own fork.

Nothing in the console calls the Hue Bridge or any service of ours. Switches send their topology to your console, and your console only answers them.

## 1. Postgres

Any Postgres 14 or newer works.

- **Neon** (free tier, also what the Vercel Marketplace installs): copy the pooled connection string into `DATABASE_URL`. Leave `DATABASE_DRIVER` unset.
- **Any other Postgres** (a local install, Docker, a managed one): set `DATABASE_URL=postgresql://user:password@host:5432/hue` and `DATABASE_DRIVER=pg`.

   ```bash
   docker run -d --name hue-db --restart unless-stopped \
     -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=hue -p 5432:5432 \
     -v hue-db:/var/lib/postgresql/data postgres:17
   ```

The console creates its tables and the first user on the first request. There is no separate migration step.

## 2. Pick how switches reach the console

A switch stores one console URL, written by Setup over USB. The firmware verifies `https://` certificates against the public certificate authorities in the Arduino-ESP32 bundle, and does no TLS over `http://`. Setup itself uses Web Serial, which Chrome only allows on `https://` pages or on `http://localhost`.

| | Option A: public name with a real certificate | Option B: plain HTTP on your LAN |
| --- | --- | --- |
| Switch URL (`DEVICE_CONSOLE_URL`) | `https://hue.example.org` | `http://192.168.1.20:3000` |
| Open Setup from | Any computer, at `https://hue.example.org/setup` | The server itself, at `http://localhost:3000/setup` |
| Certificate | From a public CA: Vercel, Let's Encrypt (DNS-01 works for a LAN-only name), a Cloudflare Tunnel, Tailscale Funnel, or a reverse proxy such as Caddy | None |
| Trade-off | Recommended. Works from anywhere. | Easiest. The device key and your Bridge's topology cross the LAN unencrypted. |

A private CA or a self-signed certificate (`https://hue.lan`) does **not** work: the firmware has no way to trust it.

Option A's name may resolve to a LAN address (split DNS) as long as the certificate comes from a public CA.

Option B with Setup on another computer: Chrome can treat one insecure origin as secure. Open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://192.168.1.20:3000`, and restart Chrome. Only do this for your own console.

## 3. Environment variables

Copy [`.env.example`](../.env.example) to `.env.local` (or set them in your host's dashboard).

| Variable | Needed | What to put |
| --- | --- | --- |
| `DATABASE_URL` | Yes | From step 1 |
| `DATABASE_DRIVER` | For non-Neon Postgres | `pg` |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `USER_EMAIL`, `USER_PASSWORD` | Yes | The first account and admin. You sign in with this password. |
| `DEVICE_CONSOLE_URL` | Yes for option B, recommended for A | The URL switches use, from step 2. Setup writes it to every board and shows it before it does. |
| `BETTER_AUTH_URL` | Option A | `https://hue.example.org`. Leave it **unset** for option B: sign-in then accepts both `localhost` and the LAN address. |
| `FIRMWARE_UPLOAD_TOKEN` | To add firmware | A long random string, e.g. `openssl rand -hex 24`. Used by the import script and by your fork's CI. |
| `CRON_SECRET` | Recommended | A random string for the daily cleanup (step 4). |

When `DEVICE_CONSOLE_URL` is unset, Setup writes `BETTER_AUTH_URL`, and when that is unset too, the address of the Setup page. A switch can never reach `localhost`, so option B must set `DEVICE_CONSOLE_URL`. Setup warns when the URL it would write is a loopback address.

Email, Google or GitHub sign-in, invites and the waitlist are optional; see the README, "Accounts and sign-in". Without email, sign-in is `USER_EMAIL` / `USER_PASSWORD` and sign-up stays closed.

A console whose `BETTER_AUTH_URL` is not `https://hue.tineira.com` shows a short Privacy page saying you run it. Link your own policy with `PRIVACY_URL` and a contact with `CONTACT_EMAIL`.

## 4. Deploy

### On Vercel

1. Fork [`tineira/hue-switch-console`](https://github.com/tineira/hue-switch-console) and import the fork as a new Vercel project.
2. Add Neon from the Vercel Marketplace (it sets `DATABASE_URL`), or paste your own `DATABASE_URL`.
3. Add the variables from step 3 to the **Production** environment, with `BETTER_AUTH_URL` and `DEVICE_CONSOLE_URL` set to your domain.
4. Deploy. `vercel.json` already runs the daily cleanup; Vercel sends `CRON_SECRET` with it.

### On your own machine

```bash
git clone https://github.com/tineira/hue-switch-console.git
cd hue-switch-console
cp .env.example .env.local   # then fill it in (step 3)
npm ci
npm run build
npm start                    # listens on port 3000; set PORT to change it
```

`next start` listens on every interface, so switches on the LAN can reach `http://<server-ip>:3000`. Keep it running with a systemd unit, `pm2`, or a container. For option A, put a reverse proxy with a public certificate in front (Caddy gets one on its own), or a Cloudflare Tunnel.

Run the cleanup once a day, for example from cron:

```bash
0 6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/cleanup
```

To update, `git pull`, `npm ci`, `npm run build`, and restart.

### Check it

Open `/login`, sign in with `USER_EMAIL` / `USER_PASSWORD`, and open **Setup**. With a board plugged in and detected, **Link to console** says "This board will talk to …" with your `DEVICE_CONSOLE_URL`.

## 5. Get firmware

A new console has no firmware, so Setup has nothing to install until you add a release. Every release waits in `/admin` → **Firmware** until an admin presses **Make current**.

### Import a release from the hosted console

```bash
FIRMWARE_UPLOAD_TOKEN=<your token> CONSOLE_URL=http://localhost:3000 \
  node scripts/import-firmware.mjs round
FIRMWARE_UPLOAD_TOKEN=<your token> CONSOLE_URL=http://localhost:3000 \
  node scripts/import-firmware.mjs simple
```

In PowerShell, set them first: `$env:FIRMWARE_UPLOAD_TOKEN="…"; $env:CONSOLE_URL="http://localhost:3000"`.

The script reads the current release from `https://hue.tineira.com/firmware/<product>/manifest.json` (or the one you name with `--version x.y.z`), downloads the four parts and checks each against its checksum, fetches the release notes and credits from `/firmware/<product>/<version>/notes`, and uploads everything to your console. `--from <url>` imports from any other console. Then open `/admin` → **Firmware** and press **Make current**.

### Build it in your fork

Each firmware repo ([`hue-round-switch`](https://github.com/tineira/hue-round-switch), [`hue-simple-switch`](https://github.com/tineira/hue-simple-switch)) builds on every push to `main` and uploads the release to a console. In your fork of a firmware repo:

1. **Settings → Secrets and variables → Actions → Variables:** add `CONSOLE_UPLOAD_URL` with your console's URL, such as `https://hue.example.org`. Unset, CI uploads to `https://hue.tineira.com`.
2. **Secrets:** add `FIRMWARE_UPLOAD_TOKEN` with the same value as your console's `FIRMWARE_UPLOAD_TOKEN`.
3. Push to `main`. The release waits in your `/admin` → **Firmware**.

Without the secret, a fork's CI still builds and skips the upload with a notice. CI must reach the upload URL from GitHub's runners, so option B consoles use the import script or `scripts/upload-firmware.mjs` with a local build instead (README, "Rollback and local builds").

## 6. Point switches at your console

1. Plug the switch into the computer running Setup (step 2) and click **Connect**.
2. **Install** the firmware if the board has none, then **Save Wi-Fi**.
3. **Link to console** makes a key for the board and writes it, with `DEVICE_CONSOLE_URL`, to the board. The step shows the URL first.

A board that was set up for another console (such as `hue.tineira.com`) shows **Linked to another console** on its console step and a **Move to this console** button. It asks before it writes anything. Moving keeps Wi-Fi and the Hue link; the board registers with your console on its next check-in, and you set its buttons or pages again in **Switches**.

To move a board back to the hosted console, link it again from `https://hue.tineira.com/setup`.

## When it breaks

| Symptom | Cause |
| --- | --- |
| Setup says the browser can't use USB | The page is not `https://` or `http://localhost` (step 2) |
| Setup warns "A board can't reach this address" | `DEVICE_CONSOLE_URL` is unset and Setup runs on `localhost`; set it to the LAN address |
| The checklist stays at "the console has no record of this board yet" | The board cannot reach `DEVICE_CONSOLE_URL`: wrong address, a firewall, or an `https://` certificate from a private CA |
| Sign-in fails on `http://<lan-ip>` or `localhost` | `BETTER_AUTH_URL` is set to another origin; for option B leave it unset |
| Setup has nothing to install | No current release: import one (step 5) and press **Make current** in `/admin` |
| Import answers `401` or `503 upload_not_configured` | `FIRMWARE_UPLOAD_TOKEN` differs from the console's, or the console has none (restart after setting it) |
