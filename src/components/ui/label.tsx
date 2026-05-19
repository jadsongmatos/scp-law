import * as React from "react";
import { Field } from "@base-ui/react/field";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "institutional text-sm font-medium leading-none select-none",
  {
    variants: {
      variant: {
        default:
          "text-gray-300 [text-shadow:0_0_6px_rgba(204,51,51,0.25)]",
        muted: "text-gray-300/60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type LabelProps = React.ComponentProps<typeof Field.Label> &
  VariantProps<typeof labelVariants> & {
    required?: boolean;
    disabled?: boolean;
  };

function Label({
  className,
  variant,
  required = false,
  disabled = false,
  children,
  ...props
}: LabelProps) {
  return (
    <Field.Label
      data-slot="label"
      data-disabled={disabled || undefined}
      className={cn(
        labelVariants({ variant }),
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <>
          <span
            aria-hidden="true"
            className="ml-1 text-red-500 [text-shadow:0_0_6px_rgba(239,68,68,0.4)]"
          >
            ✦
          </span>
          <span className="sr-only">(required)</span>
        </>
      )}
    </Field.Label>
  );
}

export { Label, labelVariants };
export type { LabelProps };
