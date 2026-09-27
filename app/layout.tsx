import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/app/site-footer";
import { PRODUCT_CONSOLE_URL } from "@/lib/web-setup/products";
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

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCT_CONSOLE_URL),
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

const themeBoot = `(function(){try{var t=localStorage.getItem("hsw-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="ember"
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
