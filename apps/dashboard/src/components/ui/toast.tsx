import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "error" | "success" | "info";

type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (input: {
    message: string;
    title?: string;
    variant?: ToastVariant;
  }) => void;
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: {
      message: string;
      title?: string;
      variant?: ToastVariant;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        id,
        message: input.message,
        title: input.title,
        variant: input.variant ?? "info",
      };
      setToasts((prev) => [...prev, item].slice(-4));
      window.setTimeout(() => dismiss(id), 5500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      error: (message, title = "Something went wrong") =>
        push({ message, title, variant: "error" }),
      success: (message, title = "Done") =>
        push({ message, title, variant: "success" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex max-w-[22rem] flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:left-auto sm:w-[min(100%-2rem,22rem)] sm:max-w-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 48, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className={cn(
                "pointer-events-auto rounded-xl border bg-card p-3 shadow-lg",
                toast.variant === "error" && "border-destructive/40",
                toast.variant === "success" && "border-emerald-500/30",
              )}
            >
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {toast.variant === "error" ? (
                    <AlertCircle className="text-destructive size-4" />
                  ) : toast.variant === "success" ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="text-muted-foreground size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  {toast.title ? (
                    <p className="text-sm font-medium">{toast.title}</p>
                  ) : null}
                  <p className="text-muted-foreground text-sm leading-snug">
                    {toast.message}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
