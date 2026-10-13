import { useState, useEffect, useRef } from 'react';

/**
 * AnimatedNumber
 * Smoothly interpolates from any previous value to `value` using a cubic
 * ease-out (1 - (1-t)^3) curve over `duration` milliseconds.
 *
 * Props:
 *   value    {number}  The target number to animate toward.
 *   prefix   {string}  Optional prefix displayed before the formatted number. Default '₹'.
 *   suffix   {string}  Optional suffix displayed after the formatted number. Default ''.
 *   decimals {number}  Decimal places for toLocaleString. Default 2.
 *   duration {number}  Animation duration in ms. Default 700.
 */
export default function AnimatedNumber({
  value,
  prefix = '₹',
  suffix = '',
  decimals = 2,
  duration = 700,
}) {
  // displayRef avoids stale-closure issues: animation always starts from
  // the most recently rendered display value, not a captured snapshot.
  const displayRef = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    // Cancel any in-flight animation so they don't race.
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }

    const startValue = displayRef.current;
    const endValue = value;
    let startTimestamp = null;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const next = startValue + (endValue - startValue) * easeProgress;
      displayRef.current = next;
      setDisplayValue(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
