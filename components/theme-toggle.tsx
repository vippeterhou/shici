"use client";

import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  function toggleTheme() {
    const current: Theme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    const nextTheme: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("shici-theme", nextTheme);
  }

  return (
    <button
      className="icon-button"
      type="button"
      onClick={toggleTheme}
      aria-label="切换颜色主题"
      title="切换颜色主题"
    >
      <Moon aria-hidden className="theme-icon-light" />
      <Sun aria-hidden className="theme-icon-dark" />
    </button>
  );
}
