"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

interface SearchFormProps {
  action?: string;
  clearHref?: string;
  defaultValue?: string;
  corpus?: string;
  label?: string;
  placeholder?: string;
}

export function SearchForm({
  action = "/",
  clearHref,
  defaultValue = "",
  corpus,
  label = "搜索题目、作者、词牌或正文关键词",
  placeholder = label,
}: SearchFormProps) {
  return (
    <Form
      className="search-form"
      action={action}
      scroll={false}
      role="search"
      onSubmit={(event) => {
        if (window.matchMedia("(pointer: coarse)").matches) {
          event.currentTarget.querySelector<HTMLInputElement>('input[name="q"]')?.blur();
        }
      }}
    >
      <Search aria-hidden className="search-form-icon" />
      <label className="sr-only" htmlFor="search">
        {label}
      </label>
      {clearHref ? (
        <ClearableSearchInput
          defaultValue={defaultValue}
          placeholder={placeholder}
          clearHref={clearHref}
        />
      ) : (
        <input
          key={defaultValue}
          id="search"
          name="q"
          type="search"
          enterKeyHint="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={80}
        />
      )}
      {corpus ? <input type="hidden" name="corpus" value={corpus} /> : null}
      <SearchSubmit />
    </Form>
  );
}

function ClearableSearchInput({
  defaultValue,
  placeholder,
  clearHref,
}: {
  defaultValue: string;
  placeholder: string;
  clearHref: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [previousDefaultValue, setPreviousDefaultValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (previousDefaultValue !== defaultValue) {
    setPreviousDefaultValue(defaultValue);
    setQuery(defaultValue);
  }

  function clearSearch() {
    setQuery("");
    inputRef.current?.focus();
    router.replace(clearHref, { scroll: false });
  }

  return (
    <div className="search-input-field">
      <input
        id="search"
        name="q"
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!event.target.value && defaultValue) {
            router.replace(clearHref, { scroll: false });
          }
        }}
        ref={inputRef}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={80}
      />
      <button
        className="search-clear"
        type="button"
        hidden={!query}
        aria-label="清除搜索"
        title="清除搜索"
        onClick={clearSearch}
      >
        <X aria-hidden />
      </button>
    </div>
  );
}

function SearchSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="button-primary"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "搜索中…" : "搜索"}
      <ArrowRight aria-hidden className="search-submit-icon" />
    </button>
  );
}
