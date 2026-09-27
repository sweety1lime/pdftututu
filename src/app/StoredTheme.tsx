"use client";

import { useEffect } from "react";
import { prefersLight } from "./fonts";

/** Для страниц без next-themes: снять тёмную тему, если на сайте выбрали светлую. */
export function StoredTheme() {
  useEffect(() => {
    if (prefersLight()) document.documentElement.classList.remove("dark");
  }, []);
  return null;
}
