import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * NumberTicker (Magic UI inspired)
 * Smoothly interpolates and animates numbers counting up/down to target values.
 */
export default function NumberTicker({
  value = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 2,
  prefix = "",
  suffix = ""
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = Number(value);
    if (isNaN(end)) return;

    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const duration = 600; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
        prevValueRef.current = end;
      }
    };

    const animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return (
    <span className={cn("inline-block tabular-nums font-mono", className)}>
      {prefix}
      {Number(displayValue || 0).toLocaleString("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      })}
      {suffix}
    </span>
  );
}

export { NumberTicker };
