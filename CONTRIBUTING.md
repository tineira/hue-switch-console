# Contributing

Thanks for helping. The Hue switch project is three repos, and this one is the hub:

| Repo | What it is | License |
| --- | --- | --- |
| [`hue-switch-console`](https://github.com/tineira/hue-switch-console) | Web console, device API, contract docs, USB installer | AGPL-3.0-only |
| [`hue-round-switch`](https://github.com/tineira/hue-round-switch) | Firmware for XIAO ESP32-S3 + Round Display (`product: "round"`) | MIT |
| [`hue-simple-switch`](https://github.com/tineira/hue-simple-switch) | Firmware for XIAO ESP32-C6 wall contacts (`product: "simple"`) | MIT; `hardware/` CERN-OHL-P-2.0 |

Console bugs and ideas go here. A bug in how a switch behaves goes to that firmware's repo. If you are not sure which one, open it here.

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report problems to [conduct@tineira.com](mailto:conduct@tineira.com).

## Ground rules

- **English everywhere:** UI text, docs, code comments, commit messages, issues.
- **This repo owns the contract.** [`docs/device-api.md`](docs/device-api.md) (endpoints, payloads, error codes) and [`docs/definitions.md`](docs/definitions.md) (recipes, channels, pages) are what every switch implements. Firmware repos follow them; they do not redefine them.
- **Contract changes start with a spec.** Anything that touches a device endpoint, a payload field, the NVS keys the console writes over USB (`HUESET`, Improv) or the installer is a cross-repo change. Open a "Contract change" issue first. If the idea is accepted, it becomes a spec in `docs/specs/` from [`TEMPLATE.md`](docs/specs/TEMPLATE.md), approved before any code.
- **Never break switches already on the wall.** The console ships first and accepts both old and new device behavior. Boards update on their owner's schedule.
- **The console never calls the Hue Bridge.** Topology arrives from the switch or `npm run push-from-bridge` on the LAN.
- **No secrets in the tree.** Real values live in `.env.local`, which is gitignored.

[`AGENTS.md`](AGENTS.md) has the full working rules, written for both people and coding agents.

## Running the console locally

You need Node 20+ and a Postgres database: a local install, Docker, or a free Neon project.

```bash
cp .env.example .env.local
npm install
npm run dev
```

In `.env.local`, set at least:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hue
DATABASE_DRIVER=pg          # omit for a Neon URL
AUTH_SECRET=                # openssl rand -base64 32
USER_EMAIL=you@example.com  # first user, also the admin
USER_PASSWORD=pick-one
EMAIL_DEV_CONSOLE=1         # print sign-in codes to the terminal instead of emailing
```

The console creates its tables and the first user on the first request. Open <http://localhost:3000/login> and sign in with `USER_EMAIL` / `USER_PASSWORD`.

To get real topology without a switch, run `npm run push-from-bridge` on a PC that can reach your Bridge (see the README).

Flashing and provisioning (`/setup`) use Web Serial. They need Chrome or Edge and a board on USB, so a person has to test them by hand. Automated browser tests of `/setup` are not expected.

## Pull requests

1. For anything bigger than a small fix, open or comment on an issue first so we agree on the approach.
2. Keep a PR to one change. Match the style of the surrounding code.
3. Before pushing, run:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```
   `npm test` runs the unit tests in `tests/` (Vitest). They cover pure logic only, with no database or browser; add one when you change parsing or validation.
4. If you change a device endpoint, update `docs/device-api.md` in the same commit.
5. User-visible changes get an entry in [`docs/changelog.md`](docs/changelog.md).
6. Say in the PR how you tested it, especially anything involving a real board or Bridge.

## License

There is no CLA and no sign-off. By contributing, you agree that your contribution is licensed under this repo's license, [AGPL-3.0-only](LICENSE). Firmware contributions are MIT, under their repo's license.
