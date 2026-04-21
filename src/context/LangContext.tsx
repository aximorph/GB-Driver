import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Lang, TranslationKey, translations } from '@/lib/i18n';

const LANG_KEY = 'app_lang';

function getStoredLang(): Lang {
  // Prefer explicit localStorage key (set by ProfilePage on save)
  const v = localStorage.getItem(LANG_KEY);
  if (v === 'th' || v === 'en') return v;

  // Fallback: read from saved profile (so it survives a page reload before first explicit save)
  try {
    const profileRaw = localStorage.getItem('driver_profile');
    if (profileRaw) {
      const profile = JSON.parse(profileRaw);
      if (profile?.language === 'th') return 'th';
    }
  } catch {}

  return 'en';
}

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => translations.en[key],
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getStoredLang);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => translations[lang][key],
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

// Convenience hook: just returns the translate function
export function useT() {
  return useContext(LangContext).t;
}
