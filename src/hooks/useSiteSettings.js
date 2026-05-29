import { useEffect, useState } from 'react';
import { cachedGet } from '../lib/apiCache';

// Defaults mirror the values that are hardcoded in Header / Footer /
// ContactPage today, so a fresh install renders correctly before admin seeds
// the site_settings table.
export const SITE_SETTINGS_DEFAULTS = {
  branch_address:     'ICAI Bhawan, 20/1, Dhantoli, Nagpur — 440 012',
  branch_phone:       '+91 712 244 1590',
  branch_email:       'nagpur@icai.org',
  branch_hours:       'Mon–Sat 10:30–18:00',
  branch_map_url:     'https://maps.google.com/?q=ICAI+Bhawan+Nagpur',
  footer_disclaimer:  '© 2026 ICAI Nagpur Branch · Demo mockup · Not affiliated with the official ICAI portal',
  social_facebook:    '',
  social_twitter:     '',
  social_linkedin:    '',
  social_youtube:     '',
  social_instagram:   '',
};

// Single shared fetch — Header, Footer and ContactPage all consume the same
// cached payload, so this only fires once per ~5 minutes.
export function useSiteSettings() {
  const [settings, setSettings] = useState(SITE_SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/site/settings', null, 300_000)
      .then((j) => {
        if (cancelled) return;
        // Merge over defaults so missing keys still resolve.
        setSettings({ ...SITE_SETTINGS_DEFAULTS, ...j });
      })
      .catch(() => { /* defaults already in state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { settings, loading };
}
