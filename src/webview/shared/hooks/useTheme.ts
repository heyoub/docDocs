/**
 * Theme detection and management hook
 */

import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { themeAtom, type ThemeKind } from '../store';

/**
 * Hook to manage theme class on document root
 * Syncs with VS Code theme and applies appropriate class
 */
export function useThemeClass(): ThemeKind {
  const [theme, setTheme] = useAtom(themeAtom);

  useEffect(() => {
    // Apply theme class to document
    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove('light', 'dark', 'high-contrast');

    // Apply current theme
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'high-contrast') {
      root.classList.add('dark', 'high-contrast');
    } else {
      root.classList.add('light');
    }
  }, [theme]);

  // Listen for system preference changes as fallback
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if we haven't received theme from VS Code
      if (!document.documentElement.dataset.vscodeTheme) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setTheme]);

  return theme;
}

/**
 * Hook to get current theme without side effects
 */
export function useTheme(): ThemeKind {
  const [theme] = useAtom(themeAtom);
  return theme;
}

/**
 * Check if current theme is dark
 */
export function useIsDarkTheme(): boolean {
  const theme = useTheme();
  return theme === 'dark' || theme === 'high-contrast';
}
