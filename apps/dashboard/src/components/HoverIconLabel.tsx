import type { ReactNode } from "react";

/** Label that eases in beside an icon on group-hover / focus. */
export function HoverIconLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] motion-reduce:transition-none"
      aria-hidden
    >
      <span className="min-w-0 overflow-hidden">
        <span className="block translate-x-1.5 pl-1.5 text-xs whitespace-nowrap opacity-0 transition-[opacity,transform] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-100 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:delay-0">
          {children}
        </span>
      </span>
    </span>
  );
}
