import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-shell page-hero">
      <div className="empty-state">
        <h1>这一页没有找到</h1>
        <p>作品可能已更名，或链接不属于当前数据版本。</p>
        <Link className="button-primary" href="/">
          返回首页
        </Link>
      </div>
    </section>
  );
}
