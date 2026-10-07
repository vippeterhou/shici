import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { href: "/", label: "发现" },
  { href: "/search", label: "搜索" },
  { href: "/corpora", label: "文库" },
  { href: "/insights", label: "数据洞察" },
  { href: "/about", label: "关于" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="wordmark" href="/" aria-label="诗笺首页">
          <span aria-hidden className="wordmark-seal">
            诗
          </span>
          <span>
            <strong>诗笺</strong>
            <small>中国古诗词</small>
          </span>
        </Link>
        <nav className="primary-nav" aria-label="主要导航">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <div className="header-search">
            <SearchForm compact />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
