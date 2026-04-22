import { useState, useEffect } from 'react';

const QUERY = '(orientation: landscape) and (min-width: 600px)';

export function useIsLandscape(): boolean {
  const [is, setIs] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return is;
}
