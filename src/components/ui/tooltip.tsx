import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

type TooltipVariant = "safe" | "euclid" | "keter" | "thaumiel" | "apollyon";

const TooltipVariantContext = React.createContext<TooltipVariant>("safe");

const tooltipContentVariants = cva(
  "institutional z-50 w-fit max-w-xs rounded px-4 py-3 text-sm text-gray-200 scp-tooltip-base",
  {
    variants: {
      variant: {
        safe: "scp-tooltip-safe",
        euclid: "scp-tooltip-euclid",
        keter: "scp-tooltip-keter",
        thaumiel: "scp-tooltip-thaumiel",
        apollyon: "scp-tooltip-apollyon",
      },
    },
    defaultVariants: {
      variant: "safe",
    },
  }
);

const TOOLTIP_TITLE_COLORS: Record<TooltipVariant, string> = {
  safe: "text-green-400",
  euclid: "text-yellow-400",
  keter: "text-red-400",
  thaumiel: "text-purple-400",
  apollyon: "text-red-900",
};

function TooltipProvider({
  delayDuration = 0,
  ...props
}: Omit<React.ComponentProps<typeof TooltipPrimitive.Provider>, "delay"> & {
  delayDuration?: number;
}) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger> & {
  asChild?: boolean;
}) {
  if (asChild && React.isValidElement(children)) {
    return (
      <TooltipPrimitive.Trigger
        data-slot="tooltip-trigger"
        render={children as React.ReactElement}
        {...props}
      />
    );
  }

  return (
    <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  );
}

function TooltipContent({
  className,
  variant = "safe",
  sideOffset = 8,
  side,
  align,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> &
  VariantProps<typeof tooltipContentVariants> & {
    sideOffset?: number;
    side?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["side"];
    align?: React.ComponentProps<typeof TooltipPrimitive.Positioner>["align"];
  }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset} side={side} align={align}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            tooltipContentVariants({ variant }),
            "animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        >
          <TooltipVariantContext.Provider value={variant ?? "safe"}>
            {children}
          </TooltipVariantContext.Provider>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

function TooltipTitle({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const variant = React.useContext(TooltipVariantContext);

  return (
    <p
      data-slot="tooltip-title"
      className={cn("font-bold", TOOLTIP_TITLE_COLORS[variant], className)}
      {...props}
    />
  );
}

function TooltipBody({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="tooltip-body"
      className={cn("mt-1 text-xs text-gray-300/80", className)}
      {...props}
    />
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipTitle,
  TooltipBody,
  TooltipProvider,
  tooltipContentVariants,
};
