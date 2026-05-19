import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

const SCROLL_THEMES = {
  safe: {
    handleClass: "scroll-handle-safe",
    centerBgClass: "scroll-center-safe",
  },
  euclid: {
    handleClass: "scroll-handle-euclid",
    centerBgClass: "scroll-center-euclid",
  },
  keter: {
    handleClass: "scroll-handle-keter",
    centerBgClass: "scroll-center-keter",
  },
  thaumiel: {
    handleClass: "scroll-handle-thaumiel",
    centerBgClass: "scroll-center-thaumiel",
  },
  apollyon: {
    handleClass: "scroll-handle-apollyon",
    centerBgClass: "scroll-center-apollyon",
  },
} as const;

const toastTextVariants = cva(
  "w-full h-full flex flex-col items-center justify-center px-2 py-2 text-center font-serif",
  {
    variants: {
      variant: {
        default: "text-[#211306]",
        success: "text-green-900",
        error: "text-red-900",
        warning: "text-yellow-950",
        info: "text-blue-950",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const iconVariants = cva(
  "shrink-0 inline mr-1 align-middle",
  {
    variants: {
      variant: {
        default: "text-[#332211]",
        success: "text-green-800",
        error: "text-red-800",
        warning: "text-yellow-900",
        info: "text-blue-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const scrollTransition = {
  type: "tween" as const,
  ease: "easeInOut" as const,
  duration: 0.8,
};

const VARIANT_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

type ScrollClassification = keyof typeof SCROLL_THEMES;
type ToastVariant = "default" | "success" | "error" | "warning" | "info";
type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface ScrollToastProps {
  id: string;
  title?: string;
  description?: string;
  message?: string;
  durationMs: number;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
  classification?: ScrollClassification;
  variant?: ToastVariant;
}

const ScrollToast: React.FC<ScrollToastProps> = ({
  id,
  message,
  durationMs,
  classification = "safe",
  variant = "default",
}) => {
  const [phase, setPhase] = useState(0);

  const theme = useMemo(
    () => SCROLL_THEMES[classification] ?? SCROLL_THEMES.safe,
    [classification]
  );
  const Icon = useMemo(() => {
    if (variant && variant !== "default" && VARIANT_ICON[variant]) {
      return VARIANT_ICON[variant];
    }
    return null;
  }, [variant]);

  useEffect(() => {
    const ENTER_MS = 600;
    const EXIT_MS = Math.max(ENTER_MS + 200, durationMs - 1200);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    timers.push(setTimeout(() => setPhase(1), ENTER_MS));
    timers.push(setTimeout(() => setPhase(2), EXIT_MS));
    timers.push(setTimeout(() => toast.dismiss(id), durationMs));
    return () => timers.forEach(clearTimeout);
  }, [id, durationMs]);

  return (
    <div className={cn("w-[300px] h-28 relative mx-auto pointer-events-auto flex justify-center")}>
      <motion.div className="h-full flex items-center">
        <motion.div
          layout
          transition={scrollTransition}
          className={cn("w-5 h-full z-20 shrink-0", theme.handleClass)}
        />
        <motion.div
          layout
          initial={{ width: 0 }}
          animate={{ width: phase === 1 ? 264 : 0 }}
          transition={scrollTransition}
          className={cn("h-[100px] z-10 overflow-hidden relative shrink-0 -mx-2", theme.centerBgClass)}
        >
          <motion.div
            className={toastTextVariants({ variant })}
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{
              opacity: phase === 1 ? 1 : 0,
              scale: phase === 1 ? 1 : 0.95,
              filter: phase === 1 ? "blur(0px)" : "blur(4px)",
            }}
            transition={{
              duration: 0.5,
              delay: phase === 1 ? 0.25 : 0,
              ease: "easeInOut",
            }}
          >
            <div className="flex flex-row items-center justify-center gap-1 w-full">
              {Icon && (
                <Icon
                  size={18}
                  className={iconVariants({ variant })}
                  aria-hidden="true"
                />
              )}
              <span className="text-xs truncate leading-snug institutional align-middle">
                {message}
              </span>
            </div>
          </motion.div>
        </motion.div>
        <motion.div
          layout
          transition={scrollTransition}
          className={cn("w-5 h-full z-20 shrink-0", theme.handleClass, "scroll-handle-flip")}
        />
      </motion.div>
    </div>
  );
};

type TriggerOptions = {
  title?: string;
  description?: string;
  message?: string;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
  classification?: ScrollClassification;
  position?: ToastPosition;
  variant?: ToastVariant;
};

const triggerScrollToast = ({
  message = "",
  durationMs = 5000,
  classification,
  position = "top-center",
  variant = "default",
}: TriggerOptions = {}) => {
  toast.custom(
    (id) => (
      <ScrollToast
        id={String(id)}
        message={message}
        durationMs={durationMs}
        classification={classification}
        variant={variant}
      />
    ),
    {
      duration: durationMs,
      position,
    }
  );
};

export { triggerScrollToast };
