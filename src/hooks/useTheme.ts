import { useState, useEffect } from 'react';

// Only 'light' | 'dark' — no system dependency
type Theme = 'light' | 'dark';

/**
 * useTheme — Fully isolated theme manager.
 * The app is NEVER affected by the OS/browser prefers-color-scheme.
 * Theme is controlled ONLY by user's explicit toggle.
 * Default is always 'dark' unless the user previously saved 'light'.
 */
export function useTheme(defaultSetting: Theme = 'dark') {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('tajdeed_theme');
    // Only accept 'light' or 'dark' — ignore any 'system' residue
    if (saved === 'light' || saved === 'dark') return saved;
    return defaultSetting === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light-mode');
      root.setAttribute('data-theme', 'dark');
      // Force browser UI elements (scrollbars, inputs) to dark
      root.style.colorScheme = 'dark';
      root.style.backgroundColor = '#07090e';
    } else {
      root.classList.remove('dark');
      root.classList.add('light-mode');
      root.setAttribute('data-theme', 'light');
      // Force browser UI elements to light
      root.style.colorScheme = 'light';
      root.style.backgroundColor = '#f1f5f9';
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#07090e' : '#f1f5f9');
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('tajdeed_theme', newTheme);
  };

  return { theme, setTheme };
}
