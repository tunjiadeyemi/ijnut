import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Use monospace labels (paths / codes). Default true. */
  mono?: boolean;
  /** Compact trigger for dense toolbars. */
  size?: "default" | "sm";
  "aria-label"?: string;
};

export function Select({
  id,
  value,
  options,
  onChange,
  placeholder = "Select…",
  className,
  disabled,
  mono = true,
  size = "default",
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "border-input bg-background hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center justify-between gap-2 rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "h-8 px-2 text-xs" : "h-9 px-2.5 text-sm",
          !selected && "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate text-xs",
            mono ? "font-mono" : "font-sans",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="border-border bg-card absolute right-0 left-0 z-60 mt-1 max-h-48 w-full overflow-auto rounded-md border py-1 shadow-md"
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={cn(
                    "hover:bg-accent flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm transition-colors",
                    isActive && "bg-accent/60",
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span
                    className={cn(
                      "min-w-0 truncate text-xs",
                      mono ? "font-mono" : "font-sans",
                    )}
                  >
                    {opt.label}
                  </span>
                  {isActive ? (
                    <Check className="text-primary size-3.5 shrink-0" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
