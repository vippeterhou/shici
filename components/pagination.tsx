import Link from "next/link";

interface PaginationProps {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
}

export function Pagination({
  page,
  pageCount,
  hrefForPage,
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }
  return (
    <nav className="pagination" aria-label="分页">
      {page > 1 ? (
        <Link className="button-secondary" href={hrefForPage(page - 1)}>
          上一页
        </Link>
      ) : (
        <span />
      )}
      <span>
        第 {page} / {pageCount} 页
      </span>
      {page < pageCount ? (
        <Link className="button-secondary" href={hrefForPage(page + 1)}>
          下一页
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
