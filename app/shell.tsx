import Link from "next/link";
import { AccountMenu } from "@/app/account-menu";
import { NavLinks } from "@/app/nav-links";
import { PageColumn } from "@/app/page-column";
import { RefusedRegisterBanner } from "@/app/refused-register-banner";
import { ThemePicker } from "@/app/theme-picker";
import { isAdminEmail } from "@/lib/account-config";

export function Shell({
  email,
  userId,
  wide,
  children,
}: {
  email?: string;
  /** Shows the refused-register banner for this account. */
  userId?: string;
  /** Workspace page (Switches, Lights, Admin): content fills the frame instead of the centered column. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Hue switch console
        </Link>
        <div className="order-last w-full sm:order-none sm:w-auto">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemePicker />
          <AccountMenu email={email} isAdmin={isAdminEmail(email)} />
        </div>
      </header>
      {userId ? <RefusedRegisterBanner userId={userId} /> : null}
      <PageColumn wide={wide}>{children}</PageColumn>
    </div>
  );
}
