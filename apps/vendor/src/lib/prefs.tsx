"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStorage, STORAGE_KEYS, writeStorage } from "./storage";

export type Theme = "dark" | "light";

interface Prefs {
  theme: Theme;
  setTheme: (t: Theme) => void;
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
}

const Ctx = createContext<Prefs | null>(null);

/** Theme (dark by default — kitchens are bright) and sound on/off, persisted in localStorage. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [soundOn, setSoundState] = useState(true);

  useEffect(() => {
    setThemeState(readStorage(STORAGE_KEYS.theme) === "light" ? "light" : "dark");
    setSoundState(readStorage(STORAGE_KEYS.sound) !== "off");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeStorage(STORAGE_KEYS.theme, t);
  }, []);
  const setSoundOn = useCallback((on: boolean) => {
    setSoundState(on);
    writeStorage(STORAGE_KEYS.sound, on ? "on" : "off");
  }, []);

  const value = useMemo(() => ({ theme, setTheme, soundOn, setSoundOn }), [theme, setTheme, soundOn, setSoundOn]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}

/** Inline script for <head>: applies the stored theme before first paint (no flash). */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${STORAGE_KEYS.theme}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
