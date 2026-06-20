import { createContext, useContext, useState, useEffect } from 'react';
import translations from '../locales/translations';
import { api } from '../api/client';

const LanguageContext = createContext();

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('parksense_lang') || 'en';
    } catch {
      return 'en';
    }
  });

  const changeLanguage = (newLang) => {
    if (translations[newLang]) {
      setLang(newLang);
      try {
        localStorage.setItem('parksense_lang', newLang);
      } catch (err) {
        console.error('Failed to save language preference', err);
      }
    }
  };

  const t = (key) => {
    const dict = translations[lang] || translations['en'];
    return dict[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Sleek Language Selector Dropdown Component
export function LanguageSelector() {
  const { lang, changeLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'hi', label: 'हिंदी', short: 'हि' },
    { code: 'kn', label: 'ಕನ್ನಡ', short: 'ಕ' }
  ];

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isOpen]);

  const activeLang = languages.find(l => l.code === lang) || languages[0];

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-200 hover:border-gray-300 dark:hover:border-white/20 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
      >
        <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2.945M11.026 2.018a10.001 10.001 0 009.68 9.68" />
        </svg>
        <span>{activeLang.label}</span>
        <svg className={`h-3 w-3 opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 shadow-lg py-1 z-50 overflow-hidden animate-fadeIn">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                changeLanguage(l.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold cursor-pointer transition-colors duration-150 ${
                l.code === lang
                  ? 'bg-[#BA5A5A]/10 text-[#BA5A5A]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <span>{l.label}</span>
              {l.code === lang && (
                <svg className="h-3.5 w-3.5 text-[#BA5A5A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Global translation queue to prevent concurrent API spam to Gemini (free-tier rate limit is 15 RPM)
const translationQueue = [];
let isProcessingQueue = false;

const processNextTranslation = async () => {
  if (translationQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }
  isProcessingQueue = true;
  const { text, lang, resolve, reject } = translationQueue.shift();
  try {
    const res = await api.translate(text, lang);
    resolve(res);
  } catch (err) {
    reject(err);
  }
  // Throttling: Wait 350ms before the next translation request to prevent rate limit exhaustion
  setTimeout(processNextTranslation, 350);
};

const queuedTranslate = (text, lang) => {
  return new Promise((resolve, reject) => {
    translationQueue.push({ text, lang, resolve, reject });
    if (!isProcessingQueue) {
      processNextTranslation();
    }
  });
};

export function TranslatedText({ text }) {
  const { lang } = useTranslation();
  
  // 1. Check if a static translation exists first
  const staticTranslation = translations[lang]?.[text];
  
  // 2. Set up state for dynamic translation
  const [dynamicText, setDynamicText] = useState(() => {
    if (staticTranslation !== undefined) return staticTranslation;
    if (lang === 'en') return text;
    
    // Check localStorage cache for dynamic translation
    const cacheKey = `parksense_trans_${lang}_${text}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn(e);
    }
    return text;
  });

  useEffect(() => {
    if (staticTranslation !== undefined) {
      setDynamicText(staticTranslation);
      return;
    }
    if (lang === 'en' || !text) {
      setDynamicText(text);
      return;
    }

    const cacheKey = `parksense_trans_${lang}_${text}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setDynamicText(cached);
        return;
      }
    } catch (e) {
      console.warn(e);
    }

    // Fetch dynamic translation via throttled queue
    queuedTranslate(text, lang)
      .then((res) => {
        const trans = res.data?.translated_text || text;
        try {
          localStorage.setItem(cacheKey, trans);
        } catch (e) {
          console.warn(e);
        }
        setDynamicText(trans);
      })
      .catch((err) => {
        console.error("Translation API error:", err);
        setDynamicText(text);
      });
  }, [text, lang, staticTranslation]);

  return <>{dynamicText}</>;
}

