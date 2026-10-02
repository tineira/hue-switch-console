// Content width inside Shell and PublicFrame. The frame (header, nav, footer) is always max-w-7xl so
// it never moves between pages; reading and step pages get a left-aligned max-w-4xl column, and
// workspace pages (`wide`) fill the frame.
export function PageColumn({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex w-full flex-1 flex-col gap-6 ${wide ? "" : "max-w-4xl"}`}>{children}</div>
  );
}
