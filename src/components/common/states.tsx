import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function EmptyIllustration() {
  return (
    <svg viewBox="0 0 160 120" className="h-28 w-36" aria-hidden>
      <defs>
        <linearGradient id="empty-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-from)" />
          <stop offset="100%" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      <rect
        x="22"
        y="18"
        width="116"
        height="84"
        rx="14"
        fill="var(--muted)"
        stroke="var(--border)"
      />
      <rect x="36" y="34" width="56" height="8" rx="4" fill="var(--border)" />
      <rect x="36" y="50" width="88" height="6" rx="3" fill="var(--border)" />
      <rect x="36" y="62" width="70" height="6" rx="3" fill="var(--border)" />
      <circle cx="112" cy="80" r="18" fill="url(#empty-g)" opacity="0.9" />
      <path
        d="M105 80h14M112 73v14"
        stroke="var(--brand-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <EmptyIllustration />
      </motion.div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-2">
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}
