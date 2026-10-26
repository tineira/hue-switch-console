/**
 * Fail if a spec / plan / prototype / design folder reappears under docs/. A cross-repo contract
 * change is proposed in a GitHub issue ("Contract change" template); other specs live in the
 * maintainer's internal tracker. docs/ only describes how shipped things work today, and
 * docs/archive/ is frozen history (docs/archive/README.md).
 */
import { existsSync } from "node:fs";

const forbidden = ["docs/specs", "docs/plans", "docs/prototypes", "docs/design"];
const found = forbidden.filter((dir) => existsSync(dir));

if (found.length > 0) {
  console.error(`check-docs-layout: ${found.join(", ")} must not exist.`);
  console.error(
    'Propose a contract change in a "Contract change" GitHub issue instead; see docs/archive/README.md.',
  );
  process.exit(1);
}
console.log("check-docs-layout: OK");
