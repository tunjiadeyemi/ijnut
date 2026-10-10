import { useEffect, useState, type ReactNode } from 'react';

const INTRO_HOLD_MS = 1400;

/** Label that starts open on load, then eases into hover / focus reveal. */
export function HoverIconLabel({ children }: { children: ReactNode }) {
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setIntro(false);
      return;
    }
    const id = window.setTimeout(() => setIntro(false), INTRO_HOLD_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <span
      className={
        intro
          ? 'grid grid-cols-[1fr] transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]'
          : 'grid grid-cols-[0fr] transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] group-active:grid-cols-[1fr] [@media(hover:none)]:grid-cols-[1fr] motion-reduce:transition-none motion-reduce:group-hover:grid-cols-[1fr]'
      }
      aria-hidden
    >
      <span className="min-w-0 overflow-hidden">
        <span
          className={
            intro
              ? 'block translate-x-0 pl-1.5 text-xs whitespace-nowrap opacity-100 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]'
              : 'block translate-x-1.5 pl-1.5 text-xs whitespace-nowrap opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-75 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-active:translate-x-0 group-active:opacity-100 [@media(hover:none)]:translate-x-0 [@media(hover:none)]:opacity-100 motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:delay-0'
          }
        >
          {children}
        </span>
      </span>
    </span>
  );
}
