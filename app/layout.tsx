import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { Analytics } from "@vercel/analytics/next"

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
      <body className={`${inter.className} bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-cyan-950/20 text-slate-900 dark:text-gray-100 min-h-screen transition-colors`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-blue-600 focus:text-white">Skip to content</a>
        <script
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
        <Toaster 
          position="top-center" 
          toastOptions={{
            className: '',
            style: {
              background: 'rgb(15 23 42 / 0.9)',
              color: '#fff',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgb(51 65 85 / 0.5)',
              borderRadius: '12px',
            },
          }}
        />
        <header className="sticky top-0 z-50 border-b border-slate-200/50 dark:border-gray-800/50">
          <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <Link 
                href="/" 
                className="group flex items-center gap-2 rounded-lg px-2 py-1 -ml-2 transition-all duration-200
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <span className="hidden sm:block text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-gray-300">
                  Prompt Optimizer
                </span>
                <span className="sm:hidden text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-gray-300">
                  Optimizer
                </span>
              </Link>
              
              <nav role="navigation" aria-label="Primary" className="flex items-center gap-1">
                <Link 
                  href="/" 
                  className="group relative px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-400 transition-all duration-200
                           hover:text-slate-900 dark:hover:text-white
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-lg"
                >
                  <span className="relative z-10">Home</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link 
                  href="/optimize" 
                  className="group relative px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-gray-400 transition-all duration-200
                           hover:text-slate-900 dark:hover:text-white
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-lg"
                >
                  <span className="relative z-10 hidden sm:inline">New Optimization</span>
                  <span className="relative z-10 sm:hidden">New</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link 
                  href="/settings" 
                  className="group relative p-1.5 sm:px-3 sm:py-1.5 text-sm font-medium text-slate-600 dark:text-gray-400 transition-all duration-200
                           hover:text-slate-900 dark:hover:text-white
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-lg"
                >
                  <svg className="w-5 h-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="relative z-10 hidden sm:inline">Settings</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}