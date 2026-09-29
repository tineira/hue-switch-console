import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/app/site-footer";
import { publicUrl } from "@/lib/account-config";
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

// Before first paint: the stored theme, else Ember on a dark system and Paper (the server default) on a light one.
const themeBoot = `(function(){var d=document.documentElement,t=null;try{t=localStorage.getItem("hsw-theme");}catch(e){}if(!t&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)t="ember";if(t)d.setAttribute("data-theme",t);})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="paper"
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
