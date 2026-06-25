import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '../lib/apiCache';

// Public GET /api/announcements. Returns currently-active announcements
// (server filters by starts_at ≤ now ≤ ends_at). 60s shared cache.
export function useAnnouncements() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    cachedGet('/api/announcements', {}, 60_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

// Wraps useAnnouncements and overlays translated titles from localeData.
// localeData keys: "announcements.{id}.title"
export function useLocalizedAnnouncements(localeData) {
  const { data, ...rest } = useAnnouncements();
  const localizedData = useMemo(() => {
    if (!data?.items) return data;
    return {
      ...data,
      items: data.items.map((a) => ({
        ...a,
        title: localeData[`announcements.${a.id}.title`] ?? a.title,
      })),
    };
  }, [data, localeData]);
  return { data: localizedData, ...rest };
}
