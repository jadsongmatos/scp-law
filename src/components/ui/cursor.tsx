import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cursorVariants = cva("", {
  variants: {
    classification: {
      safe: "",
      keter: "scp-keter-cursor",
      thaumiel: "scp-thaumiel-cursor",
      euclid: "scp-euclid-cursor",
      apollyon: "scp-apollyon-cursor",
    },
  },
  defaultVariants: {
    classification: "safe"
  },
});

export interface CursorProps extends React.ComponentProps<"div">, VariantProps<typeof cursorVariants> {
  classification?: "safe" | "keter" | "thaumiel" | "euclid" | "apollyon";
}

export const Cursor: React.FC<CursorProps> = ({
  className,
  classification = "safe",
  children,
  ...props
}) => {
  const cursorClass = cursorVariants({ classification });

  return (
    <div
      className={cn("scp-cursor", cursorClass, className)}
      {...props}
    >
      {children}
    </div>
  );
};
