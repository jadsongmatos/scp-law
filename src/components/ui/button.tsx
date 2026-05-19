import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "institutional inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all duration-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-center px-5 py-4 bg-cover bg-no-repeat text-white hover:brightness-110 active:scale-95 active:brightness-75 active:shadow-inner border-solid [border-image-repeat:stretch] border-5 [border-image-slice:16_fill] scp-btn-border",
        frame:
          "bg-center bg-cover bg-no-repeat text-white hover:brightness-110 active:scale-95 active:brightness-75 active:shadow-inner border-solid [border-image-repeat:stretch] border-5 [border-image-slice:16_fill] scp-btn-border-frame",
        ghost:
          "bg-transparent text-zinc-300 hover:text-noir-amber cursor-pointer",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Button({
  className,
  variant,
  asChild = false,
  style,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const mergedClassName = cn(
    buttonVariants({ variant }),
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
      style: { ...style, ...child.props.style },
    });
  }

  return (
    <button
      className={mergedClassName}
      style={style}
      data-slot="button"
      {...props}
    >
      {children}
    </button>
  );
}

export { Button, buttonVariants };
