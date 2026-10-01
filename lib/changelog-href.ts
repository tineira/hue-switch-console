const VERSION = /^\d+\.\d+\.\d+$/;

// /changelog shows one changelog at a time, named by `?product=`; the order is the picker's.
export const CHANGELOG_IDS = ["round", "simple", "console"] as const;
export type ChangelogId = (typeof CHANGELOG_IDS)[number];

export function isChangelogId(value: unknown): value is ChangelogId {
  return CHANGELOG_IDS.includes(value as ChangelogId);
}

export function changelogHref(id: ChangelogId, hash?: string): string {
  return `/changelog?product=${id}${hash ? `#${hash}` : ""}`;
}

export function firmwareChangelogHref(
  productId: "round" | "simple" | null,
  version: string,
): string | null {
  if (!productId) return null;
  const trimmed = version.trim();
  if (!VERSION.test(trimmed)) return null;
  return changelogHref(productId, `${productId}-${trimmed}`);
}
