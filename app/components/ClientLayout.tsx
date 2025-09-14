"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "./ClientComponents";

// Dynamically import components that might be affected by extensions
const Header = dynamic(() => import("./Header"), {
  ssr: false,
  loading: () => (
    <div className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800" />
  ),
});

const SkipToContentLink = dynamic(() => import("./SkipToContentLink"), {
  ssr: false,
});

// Error boundary for client-side errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error in component:", error, errorInfo);
    // Consider logging to an error reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
              Something went wrong
            </h2>
            <p className="text-red-700 dark:text-red-300 text-sm mb-4">
              We're sorry, but an unexpected error occurred. Please try
              refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <ErrorBoundary>
      <div className={`min-h-screen flex flex-col ${theme}`}>
        <SkipToContentLink />
        <Header />
        <main
          id="main"
          className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8"
        >
          {children}
        </main>
      </div>
    </ErrorBoundary>
  );
}
