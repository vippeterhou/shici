import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@/app/globals.css";
import { SiteHeader } from "@/components/site-header";
import { FilterNavigationProvider } from "@/components/filter-navigation";
import { getReleaseVersion } from "@/lib/data";
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
    default: "中国古典诗词",
    template: "%s · 中国古典诗词",
  },
  description: "中国古典诗词检索、阅读与探索。",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "中国古典诗词",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
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
        <FilterNavigationProvider>
          <div className="site-frame">
            <SiteHeader release={getReleaseVersion()} />
            <main id="main-content">{children}</main>
          </div>
        </FilterNavigationProvider>
      </body>
    </html>
  );
}
