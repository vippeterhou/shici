import { Search } from "lucide-react";

interface SearchFormProps {
  defaultValue?: string;
  compact?: boolean;
  corpus?: string;
  label?: string;
  autoFocus?: boolean;
}

export function SearchForm({
  defaultValue = "",
  compact = false,
  corpus,
  label = "搜索题目、作者、词牌、分类或正文",
  autoFocus = false,
}: SearchFormProps) {
  return (
    <form
      className={`search-form${compact ? " search-form-compact" : ""}`}
      action="/search"
      role="search"
    >
      <Search aria-hidden className="search-form-icon" />
      <label className="sr-only" htmlFor={compact ? "header-search" : "search"}>
        {label}
      </label>
      <input
        id={compact ? "header-search" : "search"}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={label}
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={80}
      />
      {corpus ? <input type="hidden" name="corpus" value={corpus} /> : null}
      <button type="submit">{compact ? "搜索" : "开始搜索"}</button>
    </form>
  );
}
