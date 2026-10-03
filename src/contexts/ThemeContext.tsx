import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  fontSize: 'normal' | 'large' | 'xlarge';
  setFontSize: (size: 'normal' | 'large' | 'xlarge') => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleDarkMode: () => {},
  setDarkMode: () => {},
  fontSize: 'normal',
  setFontSize: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('taourirt_theme_mode');
      if (saved) {
        return saved === 'dark';
      }
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const [fontSize, setFontSizeState] = useState<'normal' | 'large' | 'xlarge'>(() => {
    try {
      const saved = localStorage.getItem('taourirt_font_size');
      if (saved && ['normal', 'large', 'xlarge'].includes(saved)) {
        return saved as 'normal' | 'large' | 'xlarge';
      }
      return 'normal';
    } catch {
      return 'normal';
    }
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (isDarkMode) {
        root.classList.add('dark');
        localStorage.setItem('taourirt_theme_mode', 'dark');
      } else {
        root.classList.remove('dark');
        localStorage.setItem('taourirt_theme_mode', 'light');
      }
    } catch (e) {
      console.warn("Error toggling dark mode class:", e);
    }
  }, [isDarkMode]);

  useEffect(() => {
    try {
      const root = document.documentElement;
      root.style.fontSize = '';
      localStorage.removeItem('taourirt_font_size');
    } catch (e) {
      console.warn("Error resetting font size:", e);
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const setDarkMode = (dark: boolean) => {
    setIsDarkMode(dark);
  };

  const setFontSize = (size: 'normal' | 'large' | 'xlarge') => {
    setFontSizeState(size);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
};
