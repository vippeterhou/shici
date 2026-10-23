"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { AdvancedSearchValues, FilterPage } from "@/lib/search-filters";

interface FilterDraft {
  path: FilterPage;
  corpus: string;
  values: AdvancedSearchValues;
  cancelPending: () => void;
}

const FilterNavigationContext = createContext<{
  draft: FilterDraft | null;
  setDraft: Dispatch<SetStateAction<FilterDraft | null>>;
} | null>(null);

export function FilterNavigationProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<FilterDraft | null>(null);
  const value = useMemo(() => ({ draft, setDraft }), [draft]);
  return <FilterNavigationContext.Provider value={value}>{children}</FilterNavigationContext.Provider>;
}

export function useFilterNavigation() {
  const context = useContext(FilterNavigationContext);
  if (!context) throw new Error("Filter navigation requires FilterNavigationProvider");
  return context;
}
