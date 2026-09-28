import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * AnimatedShinyText (Magic UI inspired)
 * Traveling gleam effect across text.
 */
export default function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
}) {
  return (
    <span
      style={{
        "--shimmer-width": `${shimmerWidth}px`,
      }}
      className={cn(
        "mx-auto max-w-md text-neutral-600/70 dark:text-neutral-400/70",
        // Shimmer effect
        "animate-shimmer bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shimmer-width)_100%]",
        // Shimmer gradient
        "bg-gradient-to-r from-transparent via-white/80 via-50% to-transparent dark:via-white/80",
        className
      )}
    >
      {children}
    </span>
  );
}

export { AnimatedShinyText };
