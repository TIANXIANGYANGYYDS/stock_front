// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { useWorkspaceState, WorkspaceStateProvider } from './useWorkspaceState';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('restores user choices after leaving and returning without keeping the workspace mounted', async () => {
  function Workspace() {
    const [value, setValue] = useWorkspaceState('selection', 'initial');
    return <button onClick={() => setValue('chosen')}>{value}</button>;
  }
  function App() {
    const [visible, setVisible] = useState(true);
    return <WorkspaceStateProvider><button onClick={() => setVisible(!visible)}>switch</button>{visible && <Workspace />}</WorkspaceStateProvider>;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => root.render(<App />));
  await act(async () => host.querySelectorAll('button')[1].click());
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).not.toContain('chosen');
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('chosen');
  await act(async () => root.unmount());
});
