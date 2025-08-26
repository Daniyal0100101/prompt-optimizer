import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import Link from 'next/link';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Prompt Optimizer",
  description: "Optimize your LLM prompts with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>){
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 text-slate-900 dark:bg-primary dark:text-text-primary transition-colors`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-blue-600 focus:text-white">Skip to content</a>
        <script
          // Apply theme before hydration to avoid flash
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var saved = localStorage.getItem('theme') || 'system';
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var dark = saved === 'dark' || (saved === 'system' && prefersDark);
                  document.documentElement.classList.toggle('dark', dark);
                } catch (e) {}
              })();
            `,
          }}
        />
        <Toaster position="top-center" />
        <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-900/60 bg-white/80 dark:bg-gray-900/80 border-b border-slate-200 dark:border-gray-800">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-lg md:text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 drop-shadow-[0_0_10px_rgba(59,130,246,0.35)]
                           hover:drop-shadow-[0_0_16px_rgba(34,211,238,0.45)] transition-all rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40">
              Prompt Optimizer
            </Link>
            <nav role="navigation" aria-label="Primary" className="flex items-center gap-1 md:gap-2 text-sm">
              <Link href="/" className="px-3 py-1.5 rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 dark:text-gray-200 dark:hover:bg-gray-800">Home</Link>
              <Link href="/optimize" className="px-3 py-1.5 rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 dark:text-gray-200 dark:hover:bg-gray-800">New Optimization</Link>
              <Link href="/settings" className="px-3 py-1.5 rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 dark:text-gray-200 dark:hover:bg-gray-800">Settings</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
