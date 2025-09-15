"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { Toaster, Analytics } from "./ClientComponents";
import Header from "./Header";
import SkipToContentLink from "./SkipToContentLink";

interface ClientLayoutProps {
  children: ReactNode;
}

function ThemedLayout({ children }: { children: ReactNode }) {
  const { effectiveTheme, mounted } = useTheme();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!mounted || !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-cyan-950/20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
          <span className="text-sm text-slate-600 dark:text-gray-400 animate-pulse">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${effectiveTheme}`}>
      <SkipToContentLink />
      <Header />
      <main
        id="main"
        className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        {children}
      </main>
      <Toaster
        position="top-center"
        toastOptions={{
          className: "!bg-slate-800 dark:!bg-slate-900 !text-white !shadow-lg",
          style: {
            background: "rgb(15 23 42 / 0.95)",
            color: "#fff",
            backdropFilter: "blur(12px)",
            border: "1px solid rgb(51 65 85 / 0.5)",
            borderRadius: "12px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          },
          duration: 4000,
          success: {
            style: {
              background: "rgb(5 150 105 / 0.95)",
              border: "1px solid rgb(16 185 129 / 0.5)",
            },
          },
          error: {
            style: {
              background: "rgb(220 38 38 / 0.95)",
              border: "1px solid rgb(239 68 68 / 0.5)",
            },
          },
        }}
      />
      <Analytics />
    </div>
  );
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ThemedLayout>{children}</ThemedLayout>
    </ThemeProvider>
  );
}
