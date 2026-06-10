import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const checkboxVariants = cva(
  "inline-flex items-center gap-3 cursor-pointer select-none institutional mb-2 font-bold",
  {
    variants: {
      classification: {
        safe: "text-green-700 dark:text-green-100",
        euclid: "text-yellow-700 dark:text-yellow-100",
        keter: "text-red-700 dark:text-red-100",
        thaumiel: "text-purple-700 dark:text-purple-100",
        apollyon: "text-red-900 dark:text-red-200",
      },
    },
    defaultVariants: {
      classification: "safe",
    },
  }
);

type Classification = "safe" | "euclid" | "keter" | "thaumiel" | "apollyon";

interface CheckboxProps
  extends Omit<
    React.ComponentProps<typeof CheckboxPrimitive.Root>,
    "children" | "asChild"
  >,
  VariantProps<typeof checkboxVariants> {
  classification?: Classification;
  children?: React.ReactNode;
}

function Checkbox({
  classification = "safe",
  children,
  className,
  disabled,
  id,
  ...props
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        checkboxVariants({ classification }),
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <CheckboxPrimitive.Root
        data-slot="checkbox"
        className={cn("scp-checkbox", `scp-checkbox-${classification}`, className)}
        disabled={disabled}
        id={id}
        {...props}
      >
        <CheckboxPrimitive.Indicator />
      </CheckboxPrimitive.Root>
      {children}
    </label>
  );
}

export { Checkbox, checkboxVariants };
export type { CheckboxProps, Classification };
