const VERSION = /^\d+\.\d+\.\d+$/;

export function firmwareChangelogHref(
  productId: "round" | "simple" | null,
  version: string,
): string | null {
  if (!productId) return null;
  const trimmed = version.trim();
  if (!VERSION.test(trimmed)) return null;
  return `/changelog#${productId}-${trimmed}`;
}
