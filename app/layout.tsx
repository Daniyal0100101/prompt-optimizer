"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./components/ClientLayout";
import {
  ThemeScript,
  Toaster,
  Analytics,
  useTheme,
} from "./components/ClientComponents";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mounted, effectiveTheme } = useTheme();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} font-sans ${
        mounted ? effectiveTheme : "dark"
      }`}
      data-theme={mounted ? effectiveTheme : "dark"}
    >
      <head>
        <meta name="google" content="notranslate" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="grammarly" content="false" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ThemeScript />
      </head>
      <body
        suppressHydrationWarning
        className="bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-cyan-950/20 text-slate-900 dark:text-gray-100 transition-colors min-h-screen"
        // Browser extension attributes that cause hydration warnings
        data-new-gr-c-s-check-loaded=""
        data-gr-ext-installed=""
      >
        {mounted ? (
          <>
            <ClientLayout>{children}</ClientLayout>
            <Toaster
              position="top-center"
              toastOptions={{
                className:
                  "!bg-slate-800 dark:!bg-slate-900 !text-white !shadow-lg",
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
          </>
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-cyan-950/20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
              <span className="text-sm text-slate-600 dark:text-gray-400 animate-pulse">
                Loading...
              </span>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
