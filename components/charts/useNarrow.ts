"use client";

import { useEffect, useState } from "react";

/**
 * Recharts sizes its category axis in pixels, not with CSS — on a phone a
 * 168px label gutter would leave almost nothing for the bars. This reports the
 * viewport class so each chart can pick its own gutter.
 *
 * Starts `false` so the server render and the first client render agree.
 */
export function useNarrow(maxWidth = 640): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [maxWidth]);

  return narrow;
}
