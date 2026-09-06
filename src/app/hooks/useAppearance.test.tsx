// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AppearanceProvider, useAppearance } from './useAppearance';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
const originalStartTransition = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
function stubStartTransition(implementation: (update: () => void) => unknown) {
  const start = vi.fn(implementation);
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  return start;
}
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function PreferenceControl() {
  const { appearance, toggleAppearance } = useAppearance();
  return <button onClick={() => toggleAppearance({ x: 100, y: 20 })}>{appearance}</button>;
}
async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(<AppearanceProvider><PreferenceControl /></AppearanceProvider>));
  return host;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalStartTransition) Object.defineProperty(document, 'startViewTransition', originalStartTransition);
  else Reflect.deleteProperty(document, 'startViewTransition');
  localStorage.clear();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-appearance');
  document.documentElement.classList.remove('dark');
});

it('restores the saved preference and persists a user theme change', async () => {
  localStorage.setItem('alpha-desk-appearance', 'dark');
  const host = await mount();
  expect(host.textContent).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  await act(async () => host.querySelector('button')!.click());
  expect(document.documentElement.dataset.appearance).toBe('light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(localStorage.getItem('alpha-desk-appearance')).toBe('light');
  expect((await mount()).textContent).toBe('light');
});

it('still renders and switches themes when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked storage'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked storage'); });
  const host = await mount();
  expect(host.textContent).toBe('light');
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toBe('dark');
  expect(document.documentElement.dataset.appearance).toBe('dark');
});

it('reveals the new theme from the control and cleans up after the native transition', async () => {
  const finished = deferred();
  const start = stubStartTransition((update) => {
    update();
    return { ready: Promise.resolve(), finished: finished.promise, skipTransition: vi.fn() };
  });
  const host = await mount();
  const button = host.querySelector('button')!;
  await act(async () => button.click());
  expect(start).toHaveBeenCalledTimes(1);
  expect(host.querySelector('button')).toBe(button);
  expect(button.textContent).toBe('dark');
  expect(localStorage.getItem('alpha-desk-appearance')).toBe('dark');
  const root = document.documentElement;
  expect(root.dataset.themeTransition).toBe('reveal');
  expect(root.style.getPropertyValue('--theme-origin-x')).toBe('100px');
  expect(root.style.getPropertyValue('--theme-origin-y')).toBe('20px');
  expect(parseFloat(root.style.getPropertyValue('--theme-radius'))).toBeGreaterThan(window.innerWidth - 100);
  await act(async () => finished.resolve());
  expect(root.dataset.themeTransition).toBeUndefined();
  expect(root.style.getPropertyValue('--theme-radius')).toBe('');
});

it('switches immediately without snapshots when the user prefers reduced motion', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  const start = stubStartTransition(() => { throw new Error('Should not capture'); });
  const host = await mount();
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toBe('dark');
  expect(start).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.themeTransition).toBeUndefined();
});

it('still changes theme if starting the native transition fails', async () => {
  stubStartTransition(() => { throw new Error('Snapshot unavailable'); });
  const host = await mount();
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toBe('dark');
  expect(localStorage.getItem('alpha-desk-appearance')).toBe('dark');
  expect(document.documentElement.dataset.themeTransition).toBeUndefined();
  expect(document.documentElement.style.getPropertyValue('--theme-origin-x')).toBe('');
});

it('preserves both rapid toggles when the first snapshot has not updated yet', async () => {
  const ready = deferred();
  const finished = deferred();
  let pendingUpdate!: () => void;
  const skipTransition = vi.fn(() => {
    // Native skip still invokes the pending update, while rejecting only ready.
    void Promise.resolve().then(() => {
      pendingUpdate();
      ready.reject(new DOMException('Skipped', 'AbortError'));
      finished.resolve();
    });
  });
  const start = stubStartTransition((update) => {
    pendingUpdate = update;
    return { ready: ready.promise, finished: finished.promise, skipTransition };
  });
  const host = await mount();
  await act(async () => host.querySelector('button')!.click());
  await act(async () => host.querySelector('button')!.click());
  expect(skipTransition).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  expect(host.textContent).toBe('light');
  expect(localStorage.getItem('alpha-desk-appearance')).toBe('light');
  expect(document.documentElement.dataset.themeTransition).toBeUndefined();
});
