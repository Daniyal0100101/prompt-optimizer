import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./components/ClientLayout";
import { ThemeScript } from "./components/ClientComponents";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "Prompt Optimizer",
  description: "Optimize your prompts for the best results from Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="grammarly" content="false" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Theme script must be in the head and run before hydration */}
        <ThemeScript />
        {/* Add a fallback class to prevent white flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Add a class to the document element to prevent white flash
                document.documentElement.classList.add('js-enabled');
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-cyan-950/20 text-slate-900 dark:text-gray-100 transition-colors min-h-screen`}
      >
        <ClientLayout>{children}</ClientLayout>
        <SpeedInsights />
      </body>
    </html>
  );
}
