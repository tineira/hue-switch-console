import Link from "next/link";
import { AccountMenu } from "@/app/account-menu";
import { NavLinks } from "@/app/nav-links";
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
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Hue switch console
        </Link>
        <div className="order-last w-full sm:order-none sm:w-auto">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemePicker />
          <AccountMenu email={email} />
        </div>
      </header>
      {children}
    </div>
  );
}
