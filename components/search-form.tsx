"use client";

import Form from "next/form";
import { ArrowRight, Search } from "lucide-react";
import { useFormStatus } from "react-dom";

interface SearchFormProps {
  defaultValue?: string;
  corpus?: string;
  label?: string;
  placeholder?: string;
}

export function SearchForm({
  defaultValue = "",
  corpus,
  label = "搜索题目、作者、词牌或正文关键词",
  placeholder = label,
}: SearchFormProps) {
  return (
    <Form
      className="search-form"
      action="/"
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
      {corpus ? <input type="hidden" name="corpus" value={corpus} /> : null}
      <SearchSubmit />
    </Form>
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
