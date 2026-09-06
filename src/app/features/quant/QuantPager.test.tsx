// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { QuantPager } from './QuantCommon';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it('jumps to a requested page and rejects pages outside the available range', async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onPageChange = vi.fn();
  const props = { page: 1, pageSize: 50, total: 1000, loading: false, onPageChange, onPageSizeChange: vi.fn() };
  await act(async () => root.render(<QuantPager {...props} />));
  const input = host.querySelector('input')!;
  const setTarget = async (value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  };
  await setTarget('12');
  expect(onPageChange).toHaveBeenLastCalledWith(12);
  onPageChange.mockClear();
  await setTarget('21');
  await setTarget('0');
  expect(onPageChange).not.toHaveBeenCalled();
  await act(async () => root.render(<QuantPager {...props} page={12} />));
  expect(input.value).toBe('12');
  await act(async () => root.unmount());
  host.remove();
});
