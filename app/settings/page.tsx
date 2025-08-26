"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ApiKeyInput from "../components/ApiKeyInput";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<string>("system");
  const mediaRef = useRef<MediaQueryList | null>(null);
  const mediaHandlerRef = useRef<((e: MediaQueryListEvent) => void) | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") || "system";
      setTheme(saved);
      const apply = () => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = saved === 'dark' || (saved === 'system' && prefersDark);
        document.documentElement.classList.toggle("dark", isDark);
      };
      apply();
      // Attach listener if initial is system
      if (saved === 'system') {
        mediaRef.current = window.matchMedia('(prefers-color-scheme: dark)');
        mediaHandlerRef.current = (e: MediaQueryListEvent) => {
          document.documentElement.classList.toggle('dark', e.matches);
        };
        mediaRef.current.addEventListener('change', mediaHandlerRef.current);
      }
    } catch {}
  }, []);

  const onThemeChange = (value: string) => {
    setTheme(value);
    try {
      localStorage.setItem("theme", value);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = value === 'dark' || (value === 'system' && prefersDark);
      document.documentElement.classList.toggle("dark", isDark);
      // Remove previous listener
      if (mediaRef.current && mediaHandlerRef.current) {
        mediaRef.current.removeEventListener('change', mediaHandlerRef.current);
        mediaHandlerRef.current = null;
      }
      // Listen to system changes only when 'system' is selected
      if (value === 'system') {
        mediaRef.current = window.matchMedia('(prefers-color-scheme: dark)');
        mediaHandlerRef.current = (e: MediaQueryListEvent) => {
          document.documentElement.classList.toggle('dark', e.matches);
        };
        mediaRef.current.addEventListener('change', mediaHandlerRef.current);
      }
    } catch {}
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRef.current && mediaHandlerRef.current) {
        mediaRef.current.removeEventListener('change', mediaHandlerRef.current);
      }
    };
  }, []);

  const handleVerified = useCallback((ok: boolean) => {
    if (ok) router.push("/optimize");
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Settings
          </h1>
          <p className="text-center text-gray-400">Manage API key and preferences</p>
        </div>

        <section className="rounded-xl p-6 bg-white border border-slate-200 dark:bg-gray-800/50 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Theme</h2>
          <div className="flex items-center space-x-3">
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              className="rounded-md px-3 py-2 bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
            <span className="text-sm text-gray-400">Follows your system when set to System</span>
          </div>
        </section>

        <section className="rounded-xl p-6 bg-white border border-slate-200 dark:bg-gray-800/50 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">API Key</h2>
          <ApiKeyInput onKeyVerified={handleVerified} />
        </section>
      </div>
    </main>
  );
}
