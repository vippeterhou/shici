import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

const navigation = vi.hoisted(() => ({ pendingHref: "" }));

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
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/filter-navigation", () => ({
  useFilterNavigation: () => ({ draft: null }),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

afterEach(() => {
  navigation.pendingHref = "";
});

describe("navigation feedback", () => {
  it("keeps idle navigation free of loading indicators", () => {
    const html = renderToStaticMarkup(<SiteHeader release="v2.2.0" />);
    expect(html).not.toContain('aria-busy="true"');
    expect(html).not.toContain('class="navigation-progress"');
    expect(html).not.toContain("正在打开");
  });

  it("shows feedback only for the pending destination and clears it afterward", () => {
    navigation.pendingHref = "/insights?corpus=ts300";
    const html = renderToStaticMarkup(<SiteHeader release="v2.2.0" />);
    expect(html.match(/aria-busy="true"/g)).toHaveLength(1);
    expect(html.match(/class="navigation-progress"/g)).toHaveLength(1);
    expect(html).toContain("正在打开统计分析…");
    expect(html).not.toContain("正在打开高级搜索");
    expect(html).toContain('href="/" aria-current="page"');

    navigation.pendingHref = "";
    const settled = renderToStaticMarkup(<SiteHeader release="v2.2.0" />);
    expect(settled).not.toContain('class="navigation-progress"');
    expect(settled).not.toContain("正在打开");
  });
});
