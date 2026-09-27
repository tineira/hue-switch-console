import type { ChangelogItem } from "@/lib/changelog-parse";

// One release-note bullet; an important one carries a text label, not only colour.
export function ChangelogItemText({ item }: { item: ChangelogItem }) {
  if (!item.important) return <>{item.text}</>;
  return (
    <>
      <span className="mr-1.5 rounded-full bg-warn-soft px-2 py-px text-[11px] font-medium text-warn">
        Important
      </span>
      <span className="text-foreground">{item.text}</span>
    </>
  );
}
