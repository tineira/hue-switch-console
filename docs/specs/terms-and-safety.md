# Terms and safety

Cross-repo spec, but not a contract change: no endpoint, payload or NVS key moves. Process: `AGENTS.md` → "Cross-repo changes" (spec first, the user approves, then each repo's checklist).

**Status:** approved 2026-09-30 by the user (§5 decided, except the country in question 2). Not implemented.

## 1. What and why

The Simple switch has a mains build: a carrier board that goes in the wall box on 220 V or 120 V. The designs are unproven, the maintainer is not an electrical engineer, and wiring rules, wire colors and who may legally do the work all vary by country. Today the risk is stated in a red box on `/how-to` and at the top of `hue-simple-switch/hardware/README.md`. Nobody has to read or accept it, and the hosted console has no Terms at all (`TERMS_URL` is unset, so `/login` shows only Privacy).

Afterwards:

- Every account on the hosted console has accepted a versioned **Terms of Use** and the **Safety notice** before using the console. The console records which version each account accepted and when.
- Accounts that already exist accept on their next visit. A material change to either text asks everyone to accept again.
- People who never sign up still see the safety content where they read the designs: the public `/how-to` guides and the firmware repos.
- Each design shows its real status (how proven it is) next to its guide.
- The guides never ask anyone to identify a conductor by its color.

This lowers the maintainer's exposure; it does not remove it. Many countries do not let a consumer waive liability for injury or gross negligence. The texts in §2.6 are drafts in plain language, **not legal advice**, and get one review by a lawyer in the maintainer's country before launch (§5, question 1).

## 2. Design

### 2.1 Two texts, two pages

| Page | What it covers | Who it binds | Ships in |
| --- | --- | --- | --- |
| `/safety` | The hardware designs: mains danger, no certification, unproven designs, local codes, electrician, wire colors, insurance | Anyone who builds from the project, on any console | Every console (it describes the project, not the operator) |
| `/terms` | Use of this console: the service, accounts, acceptable use, no warranty, limitation of liability, governing law | Accounts on this console | Hosted console text. A self-hosted console links its operator's `TERMS_URL`, or has none |

Both are public pages in `PublicFrame`, linked from the site footer (next to Privacy) and under the sign-in form. `/terms` shows the hosted text only when `isHostedConsole()`, the same pattern `/privacy` uses. On a self-hosted console with `TERMS_URL` set, `/terms` redirects there; with it unset, the console has no Terms and only Safety is accepted.

### 2.2 Versions

`lib/terms.ts` holds the current versions as dates:

```ts
export const SAFETY_VERSION = "2026-10-01";
export const TERMS_VERSION = "2026-10-01";
```

Each page shows "Last updated <date>". A material change (new risk, new obligation, changed liability) bumps the version, which asks everyone to accept again. A typo fix or rewording that changes no meaning does not. A self-hosted operator who changes their `TERMS_URL` text bumps `TERMS_VERSION` through an env var, `TERMS_VERSION`, which overrides the constant when set. Without a `TERMS_URL`, the Terms version is ignored.

### 2.3 Recording acceptance

New table, append-only, so the history survives a re-acceptance:

```sql
create table if not exists terms_acceptances (
  user_id uuid not null references users (id) on delete cascade,
  document text not null check (document in ('safety', 'terms')),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, document, version)
);
```

No IP address and no user agent: the account, the version and the time are enough, and `/privacy` promises minimal data. `/privacy` gets one line: "When you accept the Terms and Safety notice, the console stores which version you accepted and when." Deleting the account deletes the rows (cascade).

`lib/terms.ts` exposes `pendingDocuments(userId): ("safety" | "terms")[]`, which is empty when the user has accepted the current version of each document this console uses.

### 2.4 The acceptance gate

Sign-up happens inside Better Auth (email code, Google, GitHub), and with OAuth the account exists before any form of ours is shown. So the gate runs after sign-in, not on the sign-in form:

- **`/accept`**: a signed-in page in a plain frame, without the app navigation. It shows a short summary of each pending document (the boxed points of §2.6.1 for Safety), a link to the full text, and one unticked checkbox per pending document:
  - "I have read the Safety notice. I understand the designs are uncertified and unproven, that mains wiring can kill, and that a qualified electrician must do any mains work."
  - "I agree to the Terms of Use."

  The button stays disabled until every box is ticked. A server action re-checks the boxes, inserts the rows and returns to `next` (checked by `safeReturnPath`). "Sign out" is the only other way out.
- **Where it applies:** every signed-in page and server action. `getSessionUser` (`lib/auth.ts`) is the one place that loads the session, so it is where the check goes: a page that calls it with pending documents redirects to `/accept?next=<path>`; a server action gets an error that says to reload. Admins are not exempt.
- **Where it does not apply:** the device API (`/api/device/*`, firmware downloads, OTA). Boards already on the wall keep working whether or not their owner has accepted. Blocking them would switch off someone's lights to collect a click. Public pages (`/`, `/how-to`, `/changelog`, `/credits`, `/privacy`, `/terms`, `/safety`) stay open.
- **Under the sign-in form:** "New accounts accept the Terms and the Safety notice before using the console." with both links. This only informs; acceptance is the `/accept` page.
- **Waitlist form:** the same line, since joining the waitlist is the first step for most people.
- **Admin:** the Users tab shows each account's accepted versions, or "Not yet" for an account that has not accepted.

### 2.5 Public guides and design status

The gate does not reach someone who reads a guide and never signs up. So:

- **Status labels.** Each build in `lib/how-to-build.ts` gets a `status` field shown as a chip next to its title on `/how-to` and on its install section:

  | Status | Meaning |
  | --- | --- |
  | `experimental` | Designed, never built and installed. Expect mistakes. |
  | `maintainer` | Built and in use by the maintainer, one installation. |
  | `community` | Built and reported working by several people. |

  Starting values in §5, question 3. The chip links to `/safety#status`, which explains the three statuses.
- **Mains warning.** The existing red box on the in-wall build (`app/how-to/build-section.tsx`, "Mains voltage can kill.") gains three points: the maintainer is not an electrical engineer; rules and wire colors vary by country, and in some countries only a licensed electrician may do this work; an uncertified device in fixed wiring can affect home insurance. It ends with a link to `/safety`. The same box is the first thing in the in-wall install steps.
- **No wire colors.** Install step "Identify the wires in the box" says to identify each conductor by testing it, never by its color, and says why: colors vary by country and by the age of the installation, and older work may not follow any convention. The illustrations keep their own colors for legibility, with a caption under the first in-wall scene: "Colors in these drawings are for telling the wires apart, not the colors in your wall." A review pass over `lib/how-to-build.ts`, the scene alt texts and `hue-simple-switch/hardware/README.md` removes any instruction that relies on a color.
- **Low-voltage builds** (Round, Simple on USB, the button box) get one line under their requirements: "Low voltage only. Never connect any pin to anything that is or was on mains." That rule already exists in the "never" list; the line puts it next to the build.

### 2.6 Draft texts

Plain language, short sentences, written for an international audience. To be reviewed by a lawyer (§5, question 1). `<COUNTRY>` is filled in from §5.

#### 2.6.1 Safety notice (`/safety`)

> **Read this before you build anything from this project.**
>
> - **Mains electricity can kill or start a fire.** The in-wall build connects to 220 V or 120 V. Only a qualified electrician should do any mains work, with the circuit switched off at the breaker and checked dead with a tester.
> - **These designs are uncertified.** No lab has tested them, and they carry no approval mark (CE, UL, SEC or any other). They may not meet the electrical rules where you live.
> - **These designs are unproven.** Some have never been built. Each guide shows its status. Expect mistakes, and report them.
> - **I am not an electrical engineer.** This is a hobby project, designed with AI assistance and checked with design-rule tools, not by a qualified engineer.
> - **Rules differ by country.** Wire colors, earthing, box sizes, and who may legally do electrical work all vary. In some countries only a licensed electrician may change fixed wiring. Never identify a wire by its color; test it.
> - **Insurance.** Installing an uncertified device in your home's wiring may affect your home insurance or your compliance with local building rules. Check before you install.
> - **Low-voltage builds have risks too.** Batteries, USB power and soldering can cause burns or damage. Never connect any pin to anything that is or was connected to mains.
> - **You build and install at your own risk.** The designs, firmware and instructions are provided "as is", without warranty of any kind, as their licenses say.
>
> If you are unsure about any step, stop and ask a qualified electrician.

The page then has: `#status` (the three statuses from §2.5), a short "If something goes wrong" (switch off at the breaker, do not touch, call an electrician or emergency services), and how to report a design problem (a GitHub issue, or privacy@tineira.com for anything that could hurt someone).

#### 2.6.2 Terms of Use (`/terms`, hosted console only)

> **1. Who we are.** Hue Switch Console at hue.tineira.com is a free, non-commercial service run by Tomas Neira, an individual, from `<COUNTRY>`. Contact: privacy@tineira.com.
>
> **2. Accepting these terms.** You accept these Terms and the Safety notice when you create an account. You must be at least 18. If you do not accept them, do not use the console.
>
> **3. What the service is.** The console lets you set up Wi-Fi switches you build yourself for Philips Hue, and install firmware on them. It is a hobby project. It is not made, endorsed or supported by Signify or Philips Hue.
>
> **4. Hardware and safety.** The console does not sell hardware. The designs, guides and firmware are community open source, uncertified and in part unproven. You decide whether and how to build and install them, and you are responsible for following the electrical rules where you live. The Safety notice is part of these Terms.
>
> **5. Your account.** Keep your sign-in secure. Use the console only for your own switches and Bridges. Do not try to break, overload or misuse the service or other people's accounts. We may suspend or close an account that does.
>
> **6. No warranty.** The service, firmware, designs and guides are provided "as is" and "as available", without warranty of any kind, express or implied, including fitness for a particular purpose and non-infringement. The service may change, be unavailable, or stop at any time. Firmware updates may change how a switch behaves.
>
> **7. Limitation of liability.** As far as the law where you live allows, Tomas Neira and the project's contributors are not liable for any damage, injury, loss or cost arising from building, installing or using anything from this project, or from using the console. Nothing in these Terms limits liability that cannot be limited by law, such as liability for death or personal injury caused by negligence where the law forbids that limit, or your rights as a consumer.
>
> **8. Open-source licenses.** The console's source is AGPL-3.0-only, and the firmware is MIT. The hardware designs are CERN-OHL-P-2.0. Those licenses govern the code and designs; these Terms govern this hosted service.
>
> **9. Changes.** We may update these Terms or the Safety notice. For a material change, the console asks you to accept the new version before you continue. Switches already installed keep working in the meantime.
>
> **10. Ending.** You can delete your account at any time from Account. We may end the service with reasonable notice where possible.
>
> **11. Law.** These Terms are governed by the laws of `<COUNTRY>`, without taking away protections the law of your own country gives you as a consumer.

## 3. Compatibility

- **Boards on the wall:** unaffected. The gate never touches the device API (§2.4).
- **Existing accounts:** one `/accept` screen on their next signed-in visit. Nothing else changes.
- **Self-hosted consoles:** get `/safety` and the gate for Safety on upgrade. Terms join the gate only when the operator sets `TERMS_URL`. The README's env table documents `TERMS_URL` and `TERMS_VERSION` together.
- **Firmware:** no change, no `FIRMWARE_VERSION` bump.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] Lawyer review of §2.6 done and edits folded in (the user arranges it; §5, question 1)
- [ ] `terms_acceptances` table in `db/schema.sql`
- [ ] `lib/terms.ts`: versions, `TERMS_VERSION` env override, `pendingDocuments`
- [ ] `/safety` page (every console), with `#status`
- [ ] `/terms` page: hosted text; redirect to `TERMS_URL` on a self-hosted console
- [ ] `/accept` page and server action; gate in `getSessionUser`; device API and public pages exempt
- [ ] Sign-in form and waitlist form line; footer links to Terms and Safety
- [ ] Admin Users tab shows accepted versions
- [ ] `/privacy`: the acceptance-record line (§2.3)
- [ ] `/how-to`: status chips, expanded mains box, "test, don't trust colors" step, illustration caption, low-voltage line
- [ ] `README.md`: env table (`TERMS_URL`, `TERMS_VERSION`), a Safety section linking `/safety`
- [ ] `docs/changelog.md` entry
- [ ] Deployed; checked on production (sign in with an existing account, see `/accept`, accept, land where you were going)

### Simple (`hue-simple-switch`)

- [ ] `hardware/`: license decided (§5, question 4); if CERN-OHL-P-2.0, `hardware/LICENSE` added and "Credits and licenses" updated
- [ ] `hardware/README.md` warning: add "not an electrical engineer", "rules and wire colors vary by country; test, don't trust colors", "insurance", and a link to the console's `/safety`
- [ ] `README.md`: short Safety section near the top linking `hardware/README.md` and `/safety`
- [ ] No `FIRMWARE_VERSION` bump (docs only)

### Round (`hue-round-switch`)

- [ ] `README.md`: short Safety section (low voltage only, no warranty, link to `/safety`)

### Cleanup

- [ ] Spec moved to `docs/specs/finished/` once all boxes are ticked

## 5. Decisions

Decided by the user on 2026-09-30.

1. **Lawyer review:** yes, once, before launch. The user arranges it; the console ships the texts only after it.
2. **Contact:** `privacy@tineira.com`. **Country for governing law (§2.6.2): still open.** Fill in `<COUNTRY>` once the user names it.
3. **Starting status:** Round on USB `maintainer`; Simple try-it and button box `maintainer`; Simple in-wall carrier board `experimental` until the user has built and installed one.
4. **Hardware license:** `hue-simple-switch/hardware/` moves to CERN-OHL-P-2.0; firmware stays MIT. `<HARDWARE LICENSE>` in §2.6.2 is CERN-OHL-P-2.0.
5. **Minimum age:** 18.
6. **Self-hosted consoles:** the Safety notice is accepted on every console.
7. **In-wall install steps:** stay public, never hidden behind acceptance.
