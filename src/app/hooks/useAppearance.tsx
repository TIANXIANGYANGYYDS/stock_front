import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

export type Appearance = 'light' | 'dark';
type TransitionOrigin = { x: number; y: number };
const STORAGE_KEY = 'alpha-desk-appearance';
const AppearanceContext = createContext<{ appearance: Appearance; toggleAppearance: (origin?: TransitionOrigin) => void }>({
  appearance: 'light',
  toggleAppearance: () => undefined,
});

function initialAppearance(): Appearance {
  try { return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const transitionRef = useRef<ViewTransition | null>(null);
  const clearTransition = () => {
    delete document.documentElement.dataset.themeTransition;
    for (const property of ['--theme-origin-x', '--theme-origin-y', '--theme-radius']) document.documentElement.style.removeProperty(property);
  };
  useEffect(() => () => {
    transitionRef.current?.skipTransition();
    transitionRef.current = null;
    clearTransition();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.classList.toggle('dark', appearance === 'dark');
    try { localStorage.setItem(STORAGE_KEY, appearance); } catch { /* Storage is optional. */ }
  }, [appearance]);

  const toggleAppearance = (origin?: TransitionOrigin) => {
    const update = () => setAppearance((current) => current === 'light' ? 'dark' : 'light');
    if (transitionRef.current) {
      transitionRef.current.skipTransition();
      transitionRef.current = null;
      clearTransition();
      update();
      return;
    }
    if (typeof document.startViewTransition !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }
    const x = Math.max(0, Math.min(window.innerWidth, origin?.x ?? window.innerWidth / 2));
    const y = Math.max(0, Math.min(window.innerHeight, origin?.y ?? window.innerHeight / 2));
    const root = document.documentElement;
    root.style.setProperty('--theme-origin-x', `${x}px`);
    root.style.setProperty('--theme-origin-y', `${y}px`);
    root.style.setProperty('--theme-radius', `${Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))}px`);
    root.dataset.themeTransition = 'reveal';
    let updated = false;
    try {
      const transition = document.startViewTransition(() => {
        flushSync(update);
        updated = true;
      });
      transitionRef.current = transition;
      // Skipping a snapshot is normal, including when the user clicks again quickly.
      void transition.ready.catch(() => undefined);
      void transition.finished.catch(() => undefined).then(() => {
        if (transitionRef.current === transition) {
          transitionRef.current = null;
          clearTransition();
        }
      });
    } catch {
      clearTransition();
      if (!updated) update();
    }
  };

  return <AppearanceContext.Provider value={{ appearance, toggleAppearance }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() { return useContext(AppearanceContext); }
