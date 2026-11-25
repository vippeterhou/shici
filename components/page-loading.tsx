export function PageLoading() {
  return (
    <section className="page-shell page-loading" role="status" aria-label="页面加载中">
      <div className="poetry-loader" aria-hidden="true">
        <div className="poetry-loader-art">
          <div className="poetry-loader-orbit">
            <span />
            <span />
            <span />
          </div>
          <span className="poetry-loader-character">诗</span>
        </div>
        <span className="poetry-loader-caption">诗意将至</span>
      </div>
      <span className="sr-only">正在加载页面…</span>
    </section>
  );
}
