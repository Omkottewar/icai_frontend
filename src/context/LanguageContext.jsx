import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const LANGS = [
  { code: 'en', label: 'EN',  native: 'English' },
  { code: 'hi', label: 'हिं', native: 'हिन्दी' },
  { code: 'mr', label: 'मरा', native: 'मराठी' },
];

const LanguageContext = createContext({
  lang: 'en',
  localeData: {},
  setLang: () => {},
  t: (_key, fallback = '') => fallback,
});

function readStorage() {
  try { return localStorage.getItem('icai_lang') || 'en'; } catch { return 'en'; }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStorage);
  const [localeData, setLocaleData] = useState({});

  useEffect(() => {
    if (lang === 'en') {
      setLocaleData({});
      return;
    }
    let cancelled = false;
    fetch(`/locales/${lang}.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { if (!cancelled) setLocaleData(d); })
      .catch(() => { if (!cancelled) setLocaleData({}); });
    return () => { cancelled = true; };
  }, [lang]);

  const setLang = useCallback((code) => {
    try { localStorage.setItem('icai_lang', code); } catch { /* private mode */ }
    setLangState(code);
  }, []);

  const t = useCallback(
    (key, fallback = '') => localeData[key] ?? fallback,
    [localeData],
  );

  return (
    <LanguageContext.Provider value={{ lang, localeData, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
