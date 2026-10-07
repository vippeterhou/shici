import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@/app/globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/site";

const themeScript = `
  (() => {
    const param = new URLSearchParams(window.location.search).get("clawpilotTheme");
    const theme =
      param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();
`;

const persistedThemeScript = `
  (() => {
    const stored = window.localStorage.getItem("shici-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  })();
`;

export const metadata: Metadata = {
  title: {
    default: "诗笺 · 中国古诗词",
    template: "%s · 诗笺",
  },
  description:
    "搜索、阅读并探索从《诗经》到唐宋的中国古典诗词。",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "诗笺",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script id="theme-detection" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Script id="persisted-theme" strategy="beforeInteractive">
          {persistedThemeScript}
        </Script>
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <div className="site-frame">
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
