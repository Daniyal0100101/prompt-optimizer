"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Create a custom hook that can be safely used in client components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (typeof window === 'undefined') {
    // Return a default theme during SSR
    return {
      themeMode: 'system' as const,
      effectiveTheme: 'light' as const,
      setTheme: () => {},
      toggleTheme: () => {},
      mounted: false
    };
  }
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [mounted, setMounted] = useState(false);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = useCallback((theme: ThemeMode) => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let newEffectiveTheme: 'light' | 'dark' = 'light';

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      newEffectiveTheme = prefersDark ? 'dark' : 'light';
    } else {
      newEffectiveTheme = theme;
    }

    root.classList.add(newEffectiveTheme);
    setEffectiveTheme(newEffectiveTheme);
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const savedTheme = (localStorage.getItem('theme') as ThemeMode) || 'system';
    setThemeMode(savedTheme);
    applyTheme(savedTheme);
    setMounted(true);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleSystemChange = (_: MediaQueryListEvent) => {
      if ((localStorage.getItem('theme') as ThemeMode) === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [applyTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('theme', mode);
    setThemeMode(mode);
    applyTheme(mode);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  }, [effectiveTheme, setTheme]);

  const value = {
    themeMode,
    effectiveTheme,
    setTheme,
    toggleTheme,
    mounted,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};