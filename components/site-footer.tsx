import Link from "next/link";
import { getReleaseVersion } from "@/lib/data";

export function SiteFooter() {
  const release = getReleaseVersion();
  return (
    <footer className="site-footer">
      <div className="page-shell footer-inner">
        <div>
          <strong>诗笺</strong>
          <p>中国古典诗词检索、阅读与探索</p>
        </div>
        <div className="footer-links">
          <Link href="/about">数据与方法</Link>
          <a
            href={`https://github.com/vippeterhou/shici-data/releases/tag/${release}`}
            rel="noreferrer"
            target="_blank"
          >
            数据版本 {release}
          </a>
          <a
            href="https://github.com/vippeterhou/shici"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
