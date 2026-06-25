import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '../lib/apiCache';
import { useLang } from '../context/LanguageContext';

const TRANSLATABLE_SETTING_KEYS = ['branch_address', 'branch_hours', 'footer_disclaimer'];

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
  const { localeData } = useLang();

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

  // Overlay locale translations for the subset of settings that are plain text
  // (address, hours, disclaimer). URL/phone/email settings are never translated.
  const translatedSettings = useMemo(() => {
    if (!localeData || Object.keys(localeData).length === 0) return settings;
    const out = { ...settings };
    for (const key of TRANSLATABLE_SETTING_KEYS) {
      const tv = localeData[`settings.${key}`];
      if (tv) out[key] = tv;
    }
    return out;
  }, [settings, localeData]);

  return { settings: translatedSettings, loading };
}
