import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * SSR-safe hook to determine if the user has requested reduced motion.
 * Avoids Next.js hydration mismatch errors by checking window compatibility post-mount.
 */
export function useSafeReducedMotion() {
  const [isMounted, setIsMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted ? shouldReduceMotion : false;
}
