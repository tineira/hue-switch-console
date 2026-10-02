// Content width inside Shell and PublicFrame. The frame (header, nav, footer) is always max-w-7xl so
// it never moves between pages. Workspace pages (`wide`) fill it; every other page gets a centered
// max-w-4xl column.
export function PageColumn({ wide, children }: { wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex w-full flex-1 flex-col gap-6 ${wide ? "" : "mx-auto max-w-4xl"}`}>
      {children}
    </div>
  );
}
