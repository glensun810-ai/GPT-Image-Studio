'use client';

import { useEffect, useState, type ReactNode } from 'react';

const THEME_KEY = 'gpt-image-studio-theme';
const SIZE_KEY = 'gpt-image-studio-ui-size';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      const s = localStorage.getItem(SIZE_KEY);
      if (t === 'dark') document.documentElement.classList.add('dark');
      if (s) document.documentElement.setAttribute('data-ui-size', s);
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  // Prevent FOUC: render a minimal shell until theme is applied
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background" />
    );
  }

  return <>{children}</>;
}
