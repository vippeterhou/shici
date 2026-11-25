import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";
import Loading from "@/app/loading";
import RootLayout from "@/app/layout";
import { PageLoading } from "@/components/page-loading";

const navigation = vi.hoisted(() => ({ pendingHref: "", pathname: "/", searchParams: "" }));

vi.mock("next/link", async () => {
  const { createContext, createElement, useContext } = await import("react");
  const PendingContext = createContext(false);
  return {
    default: ({
      href,
      children,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      prefetch?: boolean;
      onNavigate?: () => void;
    }) => {
      delete props.prefetch;
      delete props.onNavigate;
      return createElement(
        PendingContext.Provider,
        { value: href === navigation.pendingHref },
        createElement("a", { href, ...props }, children),
      );
    },
    useLinkStatus: () => ({ pending: useContext(PendingContext) }),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.searchParams),
}));

vi.mock("@/components/filter-navigation", () => ({
  useFilterNavigation: () => ({ draft: null }),
  FilterNavigationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/data", () => ({
  getReleaseVersion: () => "v3.2.0",
}));

vi.mock("next/script", () => ({
  default: () => null,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

afterEach(() => {
  navigation.pendingHref = "";
  navigation.pathname = "/";
  navigation.searchParams = "";
});

describe("navigation feedback", () => {
  it("links to poetry rhymes without carrying corpus filters and marks it active", () => {
    navigation.pathname = "/rhymes";
    navigation.searchParams = "q=风";
    const html = renderToStaticMarkup(<SiteHeader release="v3.2.0" />);
    expect(html).toContain('href="/rhymes" aria-current="page"');
    expect(html).toContain("诗韵");
    expect(html).not.toContain('href="/rhymes?');
    expect(html).toContain('href="/corpora"');
    expect(html).toContain('href="/insights"');
    expect(html).not.toContain("?q=");
  });

  it("keeps idle navigation free of pending state", () => {
    const html = renderToStaticMarkup(<SiteHeader release="v2.2.0" />);
    expect(html).not.toContain('aria-busy="true"');
    expect(html).not.toContain('class="page-loading"');
    expect(html).not.toContain("正在打开");
  });

  it("shows feedback only for the pending destination and clears it afterward", () => {
    navigation.pendingHref = "/insights?corpus=ts300";
    const html = renderToStaticMarkup(<SiteHeader release="v2.2.0" />);
    expect(html.match(/aria-busy="true"/g)).toHaveLength(1);
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("正在打开");
    expect(html).toContain('href="/" aria-current="page"');

    navigation.pendingHref = "";
    const settled = renderToStaticMarkup(<SiteHeader release="v2.2.0" />);
    expect(settled).not.toContain('aria-busy="true"');
    expect(settled).not.toContain("正在打开");
  });

  it("shares one status between pending navigation and the page loading fallback", () => {
    navigation.pendingHref = "/insights?corpus=ts300";
    const html = renderToStaticMarkup(
      <RootLayout>
        <Loading />
      </RootLayout>,
    );
    expect(html).toContain('role="status" aria-label="页面加载中"');
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html.match(/class="poetry-loader-orbit"/g)).toHaveLength(1);
    expect(html.match(/正在加载页面…/g)).toHaveLength(1);
    expect(html).toContain('class="poetry-loader" aria-hidden="true"');
    expect(html).toContain("诗意将至");
    expect(html).not.toContain("loading-placeholder");
    expect(html).not.toContain("正在打开");
    expect(html).not.toContain("请稍候");
  });

  it("has the same loading animation ready before the destination responds", () => {
    navigation.pendingHref = "/insights?corpus=ts300";
    const pending = renderToStaticMarkup(
      <RootLayout><section>当前页面</section></RootLayout>,
    );
    const loading = renderToStaticMarkup(<PageLoading />);
    expect(pending).toContain(
      `<main id="main-content"><div class="navigation-placeholder">${loading}</div><section>当前页面</section>`,
    );
    expect(pending.match(/class="primary-nav-label" aria-busy="true"/g)).toHaveLength(1);
    expect(pending.match(/role="status"/g)).toHaveLength(1);

    navigation.pendingHref = "";
    const settled = renderToStaticMarkup(
      <RootLayout><section>统计内容</section></RootLayout>,
    );
    expect(settled).not.toContain('class="primary-nav-label" aria-busy="true"');
    expect(settled).toContain("<section>统计内容</section>");
  });

  it("keeps the animation in the layout when the route fallback takes over", () => {
    const loading = renderToStaticMarkup(<PageLoading />);
    const fallback = renderToStaticMarkup(<Loading />);
    expect(fallback).not.toContain("poetry-loader");

    navigation.pendingHref = "/insights?corpus=ts300";
    const pending = renderToStaticMarkup(
      <RootLayout><section>当前页面</section></RootLayout>,
    );
    navigation.pendingHref = "";
    navigation.pathname = "/insights";
    const streaming = renderToStaticMarkup(<RootLayout><Loading /></RootLayout>);
    for (const html of [pending, streaming]) {
      expect(html).toContain(
        `<main id="main-content"><div class="navigation-placeholder">${loading}</div>`,
      );
      expect(html.match(/class="poetry-loader-orbit"/g)).toHaveLength(1);
    }
    expect(streaming).toContain(fallback);
  });
});
