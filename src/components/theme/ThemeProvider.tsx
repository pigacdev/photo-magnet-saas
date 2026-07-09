"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  type AppTheme,
} from "@/lib/themeStorage";

type ThemeContextValue = {
  theme?: AppTheme;
  resolvedTheme?: AppTheme;
  setTheme: Dispatch<SetStateAction<AppTheme>>;
};

const ThemeContext = createContext<ThemeContextValue>({
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light");
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  const setTheme = useCallback<Dispatch<SetStateAction<AppTheme>>>((next) => {
    setThemeState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      applyTheme(value);
      persistTheme(value);
      return value;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme: mounted ? theme : undefined,
      resolvedTheme: mounted ? theme : undefined,
      setTheme,
    }),
    [mounted, theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
