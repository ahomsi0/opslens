"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "opslens-theme";

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The pre-paint script in <head> already set data-theme on <html>, so
  // reading from there avoids hydration mismatches with localStorage.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    const fromAttr = document.documentElement.getAttribute("data-theme");
    if (fromAttr === "light" || fromAttr === "dark") return fromAttr;
    return "dark";
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore quota / privacy errors */
    }
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) {
    // Defensive default — returning a no-op context lets components mount
    // outside the provider (e.g. inside Suspense fallbacks) without crashing.
    return {
      theme: "dark",
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return v;
}

// Script string injected into <head> to set data-theme before the first
// paint. Prevents a flash of dark theme when the user has chosen light.
export const themeInitScript = `
(function(){try{
  var t=localStorage.getItem('${STORAGE_KEY}');
  if(t!=='light'&&t!=='dark'){t='dark';}
  document.documentElement.setAttribute('data-theme',t);
  document.documentElement.style.colorScheme=t;
}catch(e){
  document.documentElement.setAttribute('data-theme','dark');
}})();
`;
