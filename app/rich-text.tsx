import { richSegments } from "@/lib/rich-text";

// Renders **label** as a UI label in the foreground colour and `code` in the mono font.
export function Rich({ text }: { text: string }) {
  return (
    <>
      {richSegments(text).map((segment, i) =>
        segment.kind === "bold" ? (
          <span key={i} className="font-medium text-foreground">
            {segment.text}
          </span>
        ) : segment.kind === "code" ? (
          <code key={i} className="font-mono text-[0.92em] text-foreground">
            {segment.text}
          </code>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}
