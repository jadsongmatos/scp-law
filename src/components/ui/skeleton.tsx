import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const skeletonVariants = cva(
  "institutional relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "rounded-md",
        circular: "rounded-full",
      },
      classification: {
        safe: "scp-skeleton",
        keter: "scp-skeleton-keter",
        thaumiel: "scp-skeleton-thaumiel",
        euclid: "scp-skeleton-euclid",
        apollyon: "scp-skeleton-apollyon",
      },
    },
    defaultVariants: {
      variant: "default",
      classification: "safe",
    },
  }
);

function Skeleton({
  className,
  variant,
  classification,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      className={cn(skeletonVariants({ variant, classification }), className)}
      data-slot="skeleton"
      {...props}
    >
      <div className="scp-skeleton-icons" aria-hidden="true" />
      <div className="scp-skeleton-shimmer" aria-hidden="true" />
    </div>
  );
}

export { Skeleton, skeletonVariants };
