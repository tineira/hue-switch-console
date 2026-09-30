import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/app/site-footer";
import { publicUrl } from "@/lib/account-config";
import { DARK_THEME_IDS, DEFAULT_DARK_THEME, DEFAULT_THEME, RETIRED_THEMES, THEME_STORAGE_KEY } from "@/app/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Set up Wi-Fi wall switches for Philips Hue from your browser and choose what each button does. Free.";

// Absolute URLs in link previews use BETTER_AUTH_URL; unset, Next.js falls back to the Vercel URL or localhost.
const siteUrl = publicUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    template: "%s · Hue switch console",
    default: "Hue switch console",
  },
  description: DESCRIPTION,
  // Pages do not set their own openGraph, so link previews keep this and app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    siteName: "Hue Switch Console",
    title: "Hue Switch Console",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

// Before first paint: the stored theme (a retired one mapped to its replacement), else Slate on a dark
// system and Slate Light (the server default) on a light one. data-scheme follows the theme's group
// (see applyTheme in app/themes.ts).
const themeBoot = `(function(){var d=document.documentElement,t=null,k=${JSON.stringify(DARK_THEME_IDS)},r=${JSON.stringify(RETIRED_THEMES)};try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch(e){}if(t&&r.hasOwnProperty(t))t=r[t];if(!t&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)t=${JSON.stringify(DEFAULT_DARK_THEME)};if(t){d.setAttribute("data-theme",t);d.setAttribute("data-scheme",k.indexOf(t)<0?"light":"dark");}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-scheme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
