import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const WorkspaceStateContext = createContext<Map<string, unknown> | null>(null);

/** Keep user choices across workspace changes without keeping data polling mounted. */
export function WorkspaceStateProvider({ children }: { children: ReactNode }) {
  const values = useRef(new Map<string, unknown>());
  return <WorkspaceStateContext.Provider value={values.current}>{children}</WorkspaceStateContext.Provider>;
}

export function useWorkspaceState<T>(key: string, initialValue: T) {
  const values = useContext(WorkspaceStateContext);
  const [value, setValue] = useState<T>(() => values?.has(key) ? values.get(key) as T : initialValue);
  const stateKey = useRef(key);
  if (stateKey.current !== key) {
    // Restore before children render so a strategy switch cannot show another strategy's filters.
    stateKey.current = key;
    setValue(values?.has(key) ? values.get(key) as T : initialValue);
  }
  useEffect(() => { values?.set(key, value); }, [key, value, values]);
  return [value, setValue] as const;
}
