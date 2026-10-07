"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="page-shell page-hero">
      <div className="empty-state">
        <h1>暂时无法打开这一页</h1>
        <p>数据服务可能正在启动，请稍后重试。</p>
        <button className="button-primary" type="button" onClick={reset}>
          重新加载
        </button>
      </div>
    </section>
  );
}
