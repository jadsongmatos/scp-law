import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva("institutional relative", {
  variants: {
    classification: {
      safe: "scp-avatar-default",
      keter: "scp-avatar-keter",
      thaumiel: "scp-avatar-thaumiel",
      euclid: "scp-avatar-euclid",
      apollyon: "scp-avatar-apollyon",
    },
    size: {
      sm: "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 xl:w-36 xl:h-36",
      md: "w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 xl:w-56 xl:h-56",
      lg: "w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 lg:w-96 lg:h-96 xl:w-[30rem] xl:h-[30rem]",
    },
  },
  defaultVariants: {
    classification: "safe",
    size: "md",
  },
});

export interface AvatarProps
  extends Omit<React.ComponentProps<"div">, "children">,
  VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
  classification?: "safe" | "euclid" | "keter" | "thaumiel" | "apollyon";
  size?: "sm" | "md" | "lg";
}

export const Avatar: React.FC<AvatarProps> = ({
  className,
  src,
  alt = "",
  fallback,
  classification = "safe",
  size = "md",
  ...props
}) => {
  const frameClasses = avatarVariants({ classification, size });

  return (
    <div className={cn(frameClasses, className)} {...props}>
      <div className="absolute inset-[20%] overflow-hidden">
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover mt-0 mb-0"
            draggable={false}
          />
        ) : fallback ? (
          <div className="flex items-center justify-center w-full h-full text-2xl select-none">
            {fallback}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-0 scale-[1.05] scp-avatar-frame" />
    </div>
  );
};

export { avatarVariants };
