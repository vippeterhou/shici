import Link from "next/link";
import { getReleaseVersion } from "@/lib/data";

export function SiteFooter() {
  const release = getReleaseVersion();
  return (
    <footer className="site-footer">
      <div className="page-shell footer-inner">
        <div>
          <strong>诗笺</strong>
          <p>让古诗词更容易被找到、读懂与重新发现。</p>
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
