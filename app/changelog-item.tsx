import { Rich } from "@/app/rich-text";
import type { ChangelogItem } from "@/lib/changelog-parse";

// One release-note bullet; an important one carries a text label, not only colour.
export function ChangelogItemText({ item }: { item: ChangelogItem }) {
  if (!item.important) return <Rich text={item.text} />;
  return (
    <>
      <span className="mr-1.5 rounded-full bg-warn-soft px-2 py-px text-[11px] font-medium text-warn">
        Important
      </span>
      <span className="text-foreground">
        <Rich text={item.text} />
      </span>
    </>
  );
}
