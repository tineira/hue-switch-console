import { ChangelogLink, NavLinks } from "@/app/nav-links";
import { SignOutButton } from "@/app/sign-out-button";
import { ThemePicker } from "@/app/theme-picker";

export function Shell({
  email,
  wide,
  children,
}: {
  email?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mx-auto flex w-full flex-1 flex-col gap-6 px-5 py-8 ${
        wide ? "max-w-7xl" : "max-w-5xl"
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Hue switch console
          </p>
          <NavLinks />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <ThemePicker />
          <ChangelogLink />
          {email ? <span className="text-muted">{email}</span> : null}
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
