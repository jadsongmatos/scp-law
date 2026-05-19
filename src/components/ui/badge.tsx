import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "institutional inline-flex items-center gap-1.5 transition-all duration-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 [border-image-repeat:stretch] border-solid",
  {
    variants: {
      variant: {
        default:
          "text-gray-200 [text-shadow:0_0_8px_rgba(239,68,68,0.3)] scp-btn-border-frame [border-image-slice:16_fill]",
        secondary:
          "text-slate-200 scp-btn-border [border-image-slice:16_fill]",
        destructive:
          "text-red-200 [text-shadow:0_0_8px_rgba(239,68,68,0.4)] scp-btn-border-frame brightness-75 hue-rotate-[320deg] [border-image-slice:16_fill]",
        outline:
          "border-red-900/50 bg-black/40 text-gray-300/80 hover:bg-black/60",
      },
      size: {
        default: "px-3 py-1 text-xs border-[3px]",
        sm: "px-2 py-0.5 text-[10px] border-[2px]",
        lg: "px-4 py-1.5 text-sm border-[4px]",
      },
      classification: {
        none: "",
        safe:
          "text-green-100 [text-shadow:0_0_10px_rgba(34,197,94,0.5)] border-green-900/50 bg-green-950/40",
        euclid:
          "text-yellow-100 [text-shadow:0_0_10px_rgba(234,179,8,0.5)] border-yellow-900/50 bg-yellow-950/40",
        keter:
          "text-red-100 [text-shadow:0_0_10px_rgba(239,68,68,0.5)] border-red-900/50 bg-red-950/40",
        thaumiel:
          "text-purple-100 [text-shadow:0_0_10px_rgba(168,85,247,0.5)] border-purple-900/50 bg-purple-950/40",
        apollyon:
          "text-red-950 [text-shadow:0_0_10px_rgba(127,29,29,0.5)] border-red-950/50 bg-red-950/40",
      },
      shape: {
        default: "rounded-md",
        shield: "rounded-t-sm rounded-b-xl border-b-[5px]",
        banner: "rounded-none clip-path-banner",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      classification: "none",
      shape: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({
  className,
  variant,
  size,
  classification,
  shape,
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const mergedClassName = cn(
    badgeVariants({ variant, size, classification, shape }),
    className
  );

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      className?: string;
      style?: React.CSSProperties;
    }>;

    return React.cloneElement(child, {
      ...props,
      className: cn(mergedClassName, child.props.className),
      style: child.props.style,
    });
  }

  return (
    <div className={mergedClassName} {...props}>
      {children}
    </div>
  );
}

Badge.displayName = "Badge";

export { Badge, badgeVariants };
