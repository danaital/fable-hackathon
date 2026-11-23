"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider } from "styled-components";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/i18n";
import { MODE_COOKIE, writePrefCookie, type Locale, type ThemeMode } from "@/lib/prefs";
import { StyledComponentsRegistry } from "@/lib/registry";
import { GlobalStyle } from "@/styles/global";
import { THEMES } from "@/styles/theme";

interface ThemeModeValue {
  mode: ThemeMode;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function useThemeMode(): ThemeModeValue {
  const value = useContext(ThemeModeContext);
  if (!value) throw new Error("useThemeMode must be used inside Providers");
  return value;
}

interface ProvidersProps {
  initialLocale: Locale;
  initialMode: ThemeMode;
  children: ReactNode;
}

export function Providers({ initialLocale, initialMode, children }: ProvidersProps) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      writePrefCookie(MODE_COOKIE, next);
      return next;
    });
  }, []);

  const modeValue = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode]);

  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={THEMES[mode]}>
        <GlobalStyle />
        <ThemeModeContext.Provider value={modeValue}>
          <I18nProvider initialLocale={initialLocale}>
            <ToastProvider>{children}</ToastProvider>
          </I18nProvider>
        </ThemeModeContext.Provider>
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
}
