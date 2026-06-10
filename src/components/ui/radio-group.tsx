import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";

import { cn } from "@/lib/utils";

interface RadioGroupProps
  extends Omit<React.ComponentProps<typeof RadioGroupPrimitive>, 'className'> {
  orientation?: "vertical" | "horizontal";
  className?: string;
}

type RadioGroupItemProps = React.ComponentProps<
  typeof RadioPrimitive.Root
>;

function RadioGroup({
  className,
  orientation = "vertical",
  ...props
}: RadioGroupProps) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn(
        "institutional flex gap-3",
        orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col",
        className
      )}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: RadioGroupItemProps) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "scp-radio-socket",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="scp-radio-indicator" />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
export type { RadioGroupProps, RadioGroupItemProps };
