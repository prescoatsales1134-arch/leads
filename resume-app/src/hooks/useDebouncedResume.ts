import { useEffect, useState } from 'react';
import type { Resume } from '@/types/resume';

export function useDebouncedResume(live: Resume, ms = 300): Resume {
  const [debounced, setDebounced] = useState(live);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(live), ms);
    return () => clearTimeout(t);
  }, [live, ms]);

  return debounced;
}
