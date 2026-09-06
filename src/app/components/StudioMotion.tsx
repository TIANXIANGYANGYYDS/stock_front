import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domMin, useIsPresent, type HTMLMotionProps } from 'motion/react';
import * as m from 'motion/react-m';
import { useMediaQuery } from '../hooks/useMediaQuery';

const MotionEnabled = createContext(false);
const SelectionId = createContext<string | undefined>(undefined);
const ease = [.22, .68, .24, 1] as const;

export function StudioMotionProvider({ children }: { children: ReactNode }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [ready, setReady] = useState(false);
  const loadFeatures = useMemo(() => () => import('./motion-features').then((module) => {
    setReady(true);
    return module.default;
  }).catch(() => domMin), []);

  return (
    <MotionEnabled.Provider value={ready && !reduced}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ duration: reduced ? 0 : .24, ease }}>
        <LazyMotion features={loadFeatures} strict>{children}</LazyMotion>
      </MotionConfig>
    </MotionEnabled.Provider>
  );
}

export function SelectionGroup({ children }: { children: ReactNode }) {
  const id = useId();
  return <SelectionId.Provider value={id}>{children}</SelectionId.Provider>;
}

/** Only this decorative marker moves; buttons and their hit targets stay in place. */
export function SelectionIndicator({ active, underline = false }: { active: boolean; underline?: boolean }) {
  const enabled = useContext(MotionEnabled);
  const id = useContext(SelectionId);
  return active ? <m.span aria-hidden="true" className={`studio-selection${underline ? ' is-underline' : ''}`}
    layoutId={enabled ? id : undefined} initial={false}
    transition={enabled ? { type: 'spring', stiffness: 480, damping: 38, mass: .7 } : { duration: 0 }} /> : null;
}

/** Keep content readable even when the optional animation chunk cannot load. */
export function useEntranceMotion({ lift = false, delay = 0 } = {}): Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'transition'> {
  const enabled = useContext(MotionEnabled);
  return {
    initial: enabled ? { opacity: 1, ...(lift ? { y: 0 } : {}) } : false,
    animate: enabled ? { opacity: [.55, 1], ...(lift ? { y: [8, 0] } : {}) } : { opacity: 1, ...(lift ? { y: 0 } : {}) },
    transition: { duration: enabled ? .28 : 0, ease, delay: enabled ? delay : 0 },
  };
}

function DisclosureContent({ id, className, children }: { id: string; className: string; children: ReactNode }) {
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.inert = !present; }, [present]);
  return <m.div ref={ref} id={id} className={className} aria-hidden={!present || undefined}
    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
    transition={{ duration: .22, ease }}>{children}</m.div>;
}

export function AnimatedDisclosure({ open, ...props }: { open: boolean; id: string; className: string; children: ReactNode }) {
  const enabled = useContext(MotionEnabled);
  if (!enabled) return open ? <div {...props} /> : null;
  return <AnimatePresence initial={false}>{open && <DisclosureContent key={props.id} {...props} />}</AnimatePresence>;
}
