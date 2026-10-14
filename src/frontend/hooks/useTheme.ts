import { useState, useEffect, useCallback } from 'react';

export function useTheme() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('notas-theme');
    return stored ? stored === 'dark' : true;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('notas-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  return { darkMode, toggleTheme };
}
