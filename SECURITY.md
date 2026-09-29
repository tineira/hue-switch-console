# Security policy

## Reporting a vulnerability

Report privately through GitHub: [open a security advisory](https://github.com/tineira/hue-switch-console/security/advisories/new). Please do not open a public issue, pull request or discussion for a vulnerability.

Include what you found, how to reproduce it, and what an attacker could do with it. You will get a first reply within a week. Once a fix ships, the advisory is published and you are credited unless you ask not to be.

This is a community project with one maintainer and no bug bounty.

## Supported versions

- **Console:** the production console at `https://hue.tineira.com`, built from `main`. Older deployments are not patched.
- **Firmware:** the current release of each product, the one `/setup` installs. Report firmware issues in [`hue-round-switch`](https://github.com/tineira/hue-round-switch/security/advisories/new) or [`hue-simple-switch`](https://github.com/tineira/hue-simple-switch/security/advisories/new). If you are not sure which repo, report here.

Self-hosted consoles are supported at the latest `main`.

## In scope

- **Device tokens** (`hsw_…`): issuing, storing, checking and revoking the keys switches use for the device API.
- **Sign-in and accounts:** Google, GitHub and emailed codes, sessions, invites, account isolation (one account reading or changing another's switches, Bridges or recipes), and `/admin`.
- **The firmware upload endpoint** (`POST /api/firmware/<product>`), the admin step that makes an upload current, and what `/firmware/<product>/manifest.json` serves, which decides what `/setup` flashes.
- **The USB installer** (`/setup`): Web Serial flashing and provisioning, including the Wi-Fi and Hue data it sends to the board.

## Out of scope

- The Philips Hue Bridge, its local API, and Hue accounts. Report those to Signify.
- Attacks that need physical access to a switch or its USB port, or control of the owner's LAN.
- Denial of service by volume, missing rate limits without a concrete impact, and reports from automated scanners without a working proof.
- Vercel, Neon, Resend and Cloudflare themselves.
