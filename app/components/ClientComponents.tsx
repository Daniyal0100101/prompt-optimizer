"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

// Get initial theme synchronously (matches ThemeScript logic)
function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";

  try {
    const savedTheme = localStorage.getItem("theme");
    if (
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "system"
    ) {
      return savedTheme;
    }
    return "system";
  } catch {
    return "system";
  }
}

// Calculate effective theme (resolves 'system' to actual theme)
function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;

  if (typeof window === "undefined") return "dark";

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

// Theme management hook
export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    getInitialTheme()
  );
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() =>
    getEffectiveTheme(getInitialTheme())
  );
  const [mounted, setMounted] = useState(false);

  // Apply theme to DOM
  const applyTheme = useCallback((mode: ThemeMode) => {
    const effective = getEffectiveTheme(mode);
    setEffectiveTheme(effective);

    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", effective === "dark");
      document.documentElement.setAttribute("data-theme", effective);
    }
  }, []);

  useEffect(() => {
    // Sync with actual DOM state on mount
    const actualTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const currentMode = getInitialTheme();
    const expectedTheme = getEffectiveTheme(currentMode);

    if (actualTheme !== expectedTheme) {
      applyTheme(currentMode);
    } else {
      setEffectiveTheme(actualTheme);
    }

    setMounted(true);

    // Listen for system theme changes (only when in system mode)
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const currentThemeMode =
        (localStorage.getItem("theme") as ThemeMode) || "system";
      if (currentThemeMode === "system") {
        const newEffective = e.matches ? "dark" : "light";
        setEffectiveTheme(newEffective);
        document.documentElement.classList.toggle(
          "dark",
          newEffective === "dark"
        );
        document.documentElement.setAttribute("data-theme", newEffective);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [applyTheme]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);

      // Update localStorage
      try {
        localStorage.setItem("theme", mode);
      } catch (e) {
        console.warn("Could not save theme preference:", e);
      }

      // Apply theme immediately
      applyTheme(mode);
    },
    [applyTheme]
  );

  // Legacy toggleTheme for backward compatibility
  const toggleTheme = useCallback(() => {
    const newMode = effectiveTheme === "dark" ? "light" : "dark";
    setTheme(newMode);
  }, [effectiveTheme, setTheme]);

  return {
    theme: effectiveTheme, // For backward compatibility
    themeMode,
    effectiveTheme,
    setTheme,
    toggleTheme,
    mounted,
  };
}

// ThemeScript component to prevent flash of incorrect theme
export const ThemeScript = () => {
  const themeScript = `
    (function() {
      try {
        const savedTheme = localStorage.getItem('theme') || 'system';
        let effectiveTheme = 'dark'; // Default fallback
        
        if (savedTheme === 'light' || savedTheme === 'dark') {
          effectiveTheme = savedTheme;
        } else if (savedTheme === 'system') {
          effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        // Apply theme immediately
        document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
        document.documentElement.setAttribute('data-theme', effectiveTheme);
      } catch (e) {
        // Fallback to dark theme
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  `;

  return (
    <script
      id="theme-script"
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
};

// Dynamic imports for client-side components
export const Toaster = dynamic(
  () => import("react-hot-toast").then((c) => c.Toaster),
  { ssr: false }
);

export const Analytics = dynamic(
  () => import("@vercel/analytics/react").then((mod) => mod.Analytics),
  { ssr: false }
);
