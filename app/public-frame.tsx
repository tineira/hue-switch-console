import Link from "next/link";
import { PageColumn } from "@/app/page-column";
import { ThemePicker } from "@/app/theme-picker";

const SIGN_IN =
  "rounded-md border border-line bg-background px-4 py-2 text-sm font-medium hover:border-filament";

// Page frame for signed-out visitors on public pages; signed-in users get Shell instead
// (docs/specs/finished/public-how-to-changelog.md §4.1). Same frame and column widths as Shell.
export function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Hue switch console
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemePicker />
          <Link href="/login" className={SIGN_IN}>
            Sign in
          </Link>
        </div>
      </header>
      <PageColumn>{children}</PageColumn>
    </main>
  );
}
