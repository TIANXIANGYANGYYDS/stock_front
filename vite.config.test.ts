import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserConfigFnObject } from 'vite';

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  // Deployment servers need not have the developer's .env.local file.
  loadEnv: vi.fn(() => ({})),
}));

import viteConfig from './vite.config';

const configure = viteConfig as UserConfigFnObject;

beforeEach(() => { vi.stubEnv('VITE_API_PROXY_TARGET', undefined); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('development proxy requirements', () => {
  it.each(['test', 'ci'])('loads Vitest in %s mode without a proxy target', mode => {
    vi.stubEnv('VITEST', 'true');
    expect(configure({ command: 'serve', mode }).server?.proxy).toBeUndefined();
  });

  it('still rejects the actual development server when its proxy target is missing', () => {
    vi.stubEnv('VITEST', undefined);
    expect(() => configure({ command: 'serve', mode: 'development' }))
      .toThrow('VITE_API_PROXY_TARGET is required for the development proxy');
  });

  it('uses the configured backend for development', () => {
    vi.stubEnv('VITEST', undefined);
    vi.stubEnv('VITE_API_PROXY_TARGET', 'http://127.0.0.1:8100');
    expect(configure({ command: 'serve', mode: 'development' }).server?.proxy)
      .toMatchObject({ '/backend-api': { target: 'http://127.0.0.1:8100', changeOrigin: true } });
  });

  it('builds the static frontend without a development proxy', () => {
    vi.stubEnv('VITEST', undefined);
    expect(configure({ command: 'build', mode: 'production' }).server?.proxy).toBeUndefined();
  });
});
