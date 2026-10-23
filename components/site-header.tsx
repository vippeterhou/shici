"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useFilterNavigation } from "@/components/filter-navigation";
import { filterHref, filterNavigationHref } from "@/lib/search-filters";

const navigation = [
  { href: "/", label: "首页" },
  { href: "/corpora", label: "高级搜索" },
  { href: "/insights", label: "统计分析" },
];

export function SiteHeader({ release }: { release: string }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="wordmark">
          <Link className="wordmark-seal" href="/" aria-label="中国古典诗词首页">
            <span aria-hidden className="wordmark-character">诗</span>
          </Link>
          <div className="wordmark-details">
            <Link href="/"><strong>中国古典诗词</strong></Link>
            <a
              className="data-version"
              href={`https://github.com/vippeterhou/shici-data/releases/tag/${release}`}
              rel="noreferrer"
              target="_blank"
            >
              数据版本 {release}
            </a>
          </div>
        </div>
        <Suspense fallback={<PrimaryNavigation />}>
          <FilteredNavigation />
        </Suspense>
        <div className="header-actions">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function FilteredNavigation() {
  const parameters = useSearchParams();
  return <PrimaryNavigation parameters={parameters} />;
}

function PrimaryNavigation({
  parameters,
}: {
  parameters?: Pick<URLSearchParams, "getAll">;
}) {
  const pathname = usePathname();
  const { draft } = useFilterNavigation();
  const activeDraft = draft?.path === pathname ? draft : null;
  return (
    <nav className="primary-nav" aria-label="主要导航">
      {navigation.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`)) ||
          (item.href === "/corpora" && pathname.startsWith("/poems/"));
        const href = item.href === "/corpora" || item.href === "/insights"
          ? activeDraft
            ? filterHref(item.href, activeDraft.corpus, activeDraft.values)
            : parameters
              ? filterNavigationHref(item.href, pathname, parameters)
              : item.href
          : item.href;
        return (
          <Link
            href={href}
            key={item.href}
            prefetch={item.href === "/" ? undefined : false}
            aria-current={isActive ? "page" : undefined}
            onNavigate={activeDraft?.cancelPending}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
