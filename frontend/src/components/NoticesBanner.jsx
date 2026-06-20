import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation, TranslatedText } from '../context/LanguageContext';

const CYCLE_DURATION = 8000; // ms between auto-cycle

export default function NoticesBanner() {
  const [notices, setNotices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const s = localStorage.getItem('margsense_dismissed_notices');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [isListViewOpen, setIsListViewOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Language & HUD
  const { lang, changeLanguage } = useTranslation();

  // ── Active notices ──
  const activeNotices = useMemo(
    () => notices.filter((n) => !dismissedIds.includes(n.id)),
    [notices, dismissedIds]
  );

  const safeCurrentIndex = useMemo(() => {
    return currentIndex >= activeNotices.length ? 0 : currentIndex;
  }, [currentIndex, activeNotices.length]);

  const cur = activeNotices[safeCurrentIndex];

  // ── Voice / Speech Synthesis ──
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const updateVoices = () => {
        if (window.speechSynthesis) {
          setVoices(window.speechSynthesis.getVoices());
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const translate = useCallback((notice) => {
    const en = { title: notice.title, message: notice.message };
    let hi = { title: 'महत्वपूर्ण सूचना', message: notice.message };
    let kn = { title: 'ಪ್ರಮುಖ ಮಾಹಿತಿ', message: notice.message };

    if (notice.id === 'civic-bbmp-orr') {
      hi = {
        title: '🚧 ORR सड़क मरम्मत कार्य शुरू',
        message: 'सिल्क बोर्ड जंक्शन के पास आउटर रिंग रोड (ORR) पर बीबीएमपी द्वारा सड़क मरम्मत एवं उपयोगिता कार्य शुरू। कृपया देरी की उम्मीद रखें।',
      };
      kn = {
        title: '🚧 ORR ರಸ್ತೆ ದುರಸ್ತಿ ಕಾಮಗಾರಿ ಪ್ರಾರಂಭ',
        message: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಜಂಕ್ಷನ್ ಬಳಿ ಹೊರ ವರ್ತುಲ ರಸ್ತೆಯಲ್ಲಿ (ORR) ಬಿಬಿಎಂಪಿಯಿಂದ ರಸ್ತೆ ದುರಸ್ತಿ ಕಾಮಗಾರಿ ಆರಂಭವಾಗಿದೆ. ಪ್ರಯಾಣದಲ್ಲಿ ವಿಳಂಬ ಸಾಧ್ಯತೆ.',
      };
    } else if (notice.id === 'civic-smart-parking') {
      hi = {
        title: '🚗 इंदिरानगर IoT स्मार्ट पार्किंग लाइव',
        message: 'इंदिरानगर 100 फीट रोड पर नए IoT-सक्षम स्मार्ट पार्किंग स्लॉट अब लाइव हैं। मार्ग Sense से स्लॉट बुक करें।',
      };
      kn = {
        title: '🚗 ಇಂದಿರಾನಗರ IoT ಸ್ಮಾರ್ಟ್ ಪಾರ್ಕಿಂಗ್ ಲೈವ್',
        message: 'ಇಂದಿರಾ ನಗರ 100 ಅಡಿ ರಸ್ತೆಯಲ್ಲಿ ಹೊಸ IoT ಆಧಾರಿತ ಸ್ಮಾರ್ಟ್ ಪಾರ್ಕಿಂಗ್ ಲಭ್ಯವಿದೆ. ಮಾರ್ಗ Sense ಮೂಲಕ ಬುಕ್ ಮಾಡಿ.',
      };
    } else if (notice.id === 'civic-metro-extension') {
      hi = {
        title: '🚌 मेट्रो फीडर बसों की आवृत्ति बढ़ी',
        message: 'भीड़ कम करने के लिए, BMRCL ने पीक आवर्स में इंदिरानगर मेट्रो स्टेशन से IT हब तक फीडर बसों की संख्या बढ़ाई है।',
      };
      kn = {
        title: '🚌 ಮೆಟ್ರೋ ಫೀಡರ್ ಬಸ್‌ಗಳ ಸಂಚಾರ ಹೆಚ್ಚಳ',
        message: 'ದಟ್ಟಣೆ ಕಡಿಮೆ ಮಾಡಲು BMRCL ಪೀಕ್ ಅವರ್‌ಗಳಲ್ಲಿ ಇಂದಿರಾನಗರ ಮೆಟ್ರೋ ನಿಲ್ದಾಣದಿಂದ ಐಟಿ ಹಬ್‌ಗಳಿಗೆ ಫೀಡರ್ ಬಸ್‌ಗಳ ಸಂಖ್ಯೆಯನ್ನು ಹೆಚ್ಚಿಸಿದೆ.',
      };
    } else if (notice.type === 'traffic' && notice.title.includes('Traffic Slowdown')) {
      const zone = notice.title.split(': ')[1] || 'ज़ोन';
      const m = notice.message.match(/(\d+(\.\d+)?%)/);
      const pct = m ? m[0] : 'काफ़ी';
      hi = {
        title: `🚨 ${zone} में भारी ट्रैफ़िक जाम`,
        message: `${zone} में अवैध पार्किंग के कारण वाहन गति सामान्य से ${pct} कम। कृपया वैकल्पिक मार्ग अपनाएँ।`,
      };
      kn = {
        title: `🚨 ${zone} ನಲ್ಲಿ ಭಾರಿ ದಟ್ಟಣೆ`,
        message: `${zone} ನಲ್ಲಿ ಅನಧಿಕೃತ ಪಾರ್ಕಿಂಗ್‌ನಿಂದಾಗಿ ವಾಹನಗಳ ವೇಗ ಶೇ. ${pct} ರಷ್ಟು ಕಡಿಮೆಯಾಗಿದೆ. ಪರ್ಯಾಯ ಮಾರ್ಗ ಬಳಸಿ.`,
      };
    }

    return { en, hi, kn };
  }, []);

  const speakNotice = useCallback(async (title, message) => {
    const synth = synthRef.current;
    if (!synth) return;

    if (synth.speaking && isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    synth.cancel();

    let translatedTitle = title;
    let translatedMessage = message;

    if (lang !== 'en') {
      const getTrans = async (text) => {
        // Try static translation mapping first
        const staticTrans = translate({ id: cur?.id, title, message, type: cur?.type })[lang];
        if (staticTrans && staticTrans.title && text === title) return staticTrans.title;
        if (staticTrans && staticTrans.message && text === message) return staticTrans.message;

        const cacheKey = `margsense_trans_${lang}_${text}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) return cached;

        try {
          const res = await api.translate(text, lang);
          const trans = res.data?.translated_text || text;
          localStorage.setItem(cacheKey, trans);
          return trans;
        } catch {
          return text;
        }
      };

      translatedTitle = await getTrans(title);
      translatedMessage = await getTrans(message);
    }

    const speakText = `${translatedTitle}. ${translatedMessage}`;

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(speakText);
      utteranceRef.current = utterance;
      utterance.lang = lang === 'en' ? 'en-US' : lang === 'hi' ? 'hi-IN' : 'kn-IN';

      const availableVoices = voices.length ? voices : synth.getVoices();
      let voice = null;
      if (lang === 'hi') {
        voice = availableVoices.find(v => v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi'));
      } else if (lang === 'kn') {
        voice = availableVoices.find(v => v.lang.toLowerCase().startsWith('kn') || v.name.toLowerCase().includes('kannada'));
      } else {
        voice = availableVoices.find(v => v.lang.toLowerCase().includes('en-us') || v.lang.toLowerCase().includes('en-gb') || v.lang.toLowerCase().includes('en'));
      }

      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = (e) => {
        console.warn("Speech synthesis error status:", e.error);
        setIsSpeaking(false);
      };

      synth.speak(utterance);
    }, 50);
  }, [lang, isSpeaking, voices, translate, cur]);

  useEffect(() => {
    stopSpeaking();
  }, [currentIndex, lang, stopSpeaking]);

  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const cycleTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.getNotices();
        if (active && data?.notices) setNotices(data.notices);
      } catch (err) {
        console.error('Failed to fetch notices:', err);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // ── Auto-cycle with timer ──
  useEffect(() => {
    if (activeNotices.length <= 1 || isPaused || selectedNotice || isListViewOpen || isExpanded || isSpeaking) {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      return;
    }

    cycleTimerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeNotices.length);
    }, CYCLE_DURATION);

    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    };
  }, [activeNotices.length, isPaused, selectedNotice, isListViewOpen, isExpanded, currentIndex, isSpeaking]);

  // ── Handlers ──
  const goNext = (e) => { e?.stopPropagation(); setCurrentIndex((p) => (p + 1) % activeNotices.length); };
  const goPrev = (e) => { e?.stopPropagation(); setCurrentIndex((p) => (p === 0 ? activeNotices.length - 1 : p - 1)); };

  const dismiss = (e, id) => {
    e?.stopPropagation();
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem('margsense_dismissed_notices', JSON.stringify(next));
  };

  const toggleLang = () => {
    const next = lang === 'en' ? 'hi' : lang === 'hi' ? 'kn' : 'en';
    changeLanguage(next);
  };

  const deepLink = (notice) => {
    setSelectedNotice(null);
    setIsListViewOpen(false);
    if (notice.type === 'traffic') navigate('/congestion');
  };

  // ── Bail if nothing to show ──
  if (activeNotices.length === 0) {
    if (notices.length === 0) return null;
    return (
      <div className="bg-gray-50/80 dark:bg-gray-900/40 border-b border-gray-200/50 dark:border-white/5 py-2 px-4 text-center text-xs text-gray-505 dark:text-gray-400">
        <span>All system alerts cleared.</span>
        <button 
          onClick={() => { setDismissedIds([]); localStorage.removeItem('margsense_dismissed_notices'); }}
          className="text-[#5E8599] dark:text-[#789FAF] font-bold hover:underline cursor-pointer ml-1.5"
        >
          Restore Alerts
        </button>
      </div>
    );
  }
  const tr = translate(cur);

  // ── Theme ──
  const getTheme = (n) => {
    const h = n.urgency === 'high';
    if (n.type === 'traffic') {
      return {
        bg: h 
          ? 'bg-red-50/90 dark:bg-red-950/20 border-red-100 dark:border-red-900/30' 
          : 'bg-amber-50/90 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
        text: h ? 'text-red-900 dark:text-red-100' : 'text-amber-900 dark:text-amber-100',
        accent: h ? 'border-l-red-500' : 'border-l-amber-500',
        badge: h 
          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50' 
          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
        dot: h ? 'bg-red-500' : 'bg-amber-500',
        progressBar: h ? 'bg-red-500' : 'bg-amber-500',
      };
    }
    if (n.type === 'circular') {
      return {
        bg: h 
          ? 'bg-purple-50/90 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30' 
          : 'bg-indigo-50/90 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30',
        text: h ? 'text-purple-900 dark:text-purple-100' : 'text-indigo-900 dark:text-indigo-100',
        accent: h ? 'border-l-purple-500' : 'border-l-indigo-500',
        badge: h 
          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50' 
          : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50',
        dot: h ? 'bg-purple-500' : 'bg-indigo-500',
        progressBar: h ? 'bg-purple-500' : 'bg-indigo-500',
      };
    }
    return {
      bg: 'bg-blue-50/90 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30',
      text: 'text-blue-900 dark:text-blue-100',
      accent: 'border-l-blue-500',
      badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50',
      dot: 'bg-blue-500',
      progressBar: 'bg-blue-500',
    };
  };
  const th = getTheme(cur);

  return (
    <>
      {/* ═══════ MAIN BANNER ═══════ */}
      <div
        className={`relative overflow-hidden transition-all duration-300 border-b border-gray-200/50 dark:border-white/10 ${th.bg} border-l-4 ${th.accent}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => { setIsPaused(false); setIsExpanded(false); }}
      >
        {/* Auto-cycle progress bar at the very bottom */}
        {activeNotices.length > 1 && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-200/30 dark:bg-white/5 z-30">
            <div 
              key={safeCurrentIndex}
              className={`h-full ${th.progressBar} opacity-60`}
              style={{
                animationName: 'progress-run',
                animationDuration: `${CYCLE_DURATION}ms`,
                animationTimingFunction: 'linear',
                animationPlayState: isPaused ? 'paused' : 'running',
                animationFillMode: 'both'
              }}
            />
          </div>
        )}

        {/* Content row */}
        <div className="relative z-20 mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 sm:px-6 py-3">

          {/* Left: live dot + type badge + text */}
          <div className="flex-1 flex items-center gap-3 overflow-hidden cursor-pointer min-w-0"
            onClick={() => setSelectedNotice(cur)}>

            {/* Pulsing radar dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${th.dot}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${th.dot}`} />
            </span>

            {/* Type badge */}
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider select-none shrink-0 ${th.badge}`}>
              {cur.type}
            </span>

            {/* Notice text */}
            <div className="flex-1 min-w-0 overflow-hidden" key={`${cur.id}-${lang}`}>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 shrink-0">
                  {cur.source}
                </span>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <span className="font-semibold truncate text-gray-900 dark:text-white"><TranslatedText text={cur.title} /></span>
                <span className="hidden md:inline text-gray-350 dark:text-gray-650">—</span>
                <span className="hidden md:inline text-gray-500 dark:text-gray-400 truncate max-w-xl text-xs font-normal"><TranslatedText text={cur.message} /></span>
              </div>
            </div>

            {/* Expand hint */}
            {isPaused && !isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                className="shrink-0 text-xs font-semibold text-[#5E8599] hover:underline cursor-pointer hidden md:inline-block"
              >
                Expand ▼
              </button>
            )}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Language toggle pill */}
            <button onClick={(e) => { e.stopPropagation(); toggleLang(); }}
              className="flex items-center justify-center h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 px-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer transition-colors"
              title="Switch Language">
              <span>{lang.toUpperCase()}</span>
            </button>

            {/* Voice Read Aloud button */}
            <button onClick={(e) => { e.stopPropagation(); speakNotice(cur.title, cur.message); }}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isSpeaking ? 'bg-command-accent/15 border-command-accent/40 text-command-accent' 
                  : 'border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              title={isSpeaking ? 'Stop Reading' : 'Read Aloud'}>
              {isSpeaking ? (
                <svg className="h-4.5 w-4.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
              ) : (
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              )}
            </button>

            {/* Nav arrows */}
            {activeNotices.length > 1 && (
              <div className="hidden md:flex items-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-0.5">
                <button onClick={goPrev} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded hover:bg-gray-150 dark:hover:bg-white/5 cursor-pointer">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 px-1.5 select-none font-mono">{safeCurrentIndex + 1}/{activeNotices.length}</span>
                <button onClick={goNext} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded hover:bg-gray-150 dark:hover:bg-white/5 cursor-pointer">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            {/* All notices button */}
            <button onClick={(e) => { e.stopPropagation(); setIsListViewOpen(true); }}
              className="px-2.5 py-1.5 rounded-lg bg-command-accent/10 border border-command-accent/20 text-command-accent hover:bg-command-accent/20 text-[10px] font-bold cursor-pointer uppercase tracking-wider">
              ALL ({activeNotices.length})
            </button>

            {/* Dismiss */}
            <button onClick={(e) => dismiss(e, cur.id)}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-750 dark:hover:text-gray-250 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer" title="Dismiss">
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* ─── Interactive inline expand ─── */}
        {isExpanded && (
          <div className="expand-slide relative z-20 mx-auto max-w-7xl px-4 sm:px-6 pb-3 pt-0">
            <div className="rounded-lg border border-gray-200/60 dark:border-white/10 bg-white/70 dark:bg-gray-900/70 p-3.5 text-xs text-gray-600 dark:text-gray-300 backdrop-blur-sm shadow-sm leading-relaxed">
              <p><TranslatedText text={cur.message} /></p>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100 dark:border-white/5 text-[10px] text-gray-400 dark:text-gray-500">
                <span>{new Date(cur.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <div className="flex gap-3">
                  {cur.type === 'traffic' && location.pathname !== '/congestion' && (
                    <button onClick={() => deepLink(cur)} className="text-command-accent font-semibold hover:underline cursor-pointer">
                      Avoid Congestion →
                    </button>
                  )}
                  <button onClick={() => { setSelectedNotice(cur); setIsExpanded(false); }} className="text-command-accent font-semibold hover:underline cursor-pointer">
                    Full Details →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ DETAIL MODAL ═══════ */}
      {selectedNotice && (() => {
        const selTr = translate(selectedNotice);
        const selTh = getTheme(selectedNotice);
        return (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-6 shadow-xl relative overflow-hidden flex flex-col">

              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${selTh.badge}`}>
                    {selectedNotice.type === 'traffic' ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : selectedNotice.type === 'circular' ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-450">{selectedNotice.source}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded border font-semibold uppercase ${
                        selectedNotice.urgency === 'high' ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'}`}>
                        {selectedNotice.urgency}
                      </span>
                      {/* Language toggle inside modal */}
                      <button onClick={toggleLang}
                        className="flex items-center h-5 rounded border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 text-[8px] font-bold text-gray-700 dark:text-gray-300">
                        {lang.toUpperCase()}
                      </button>

                      {/* Voice Read Aloud inside modal */}
                      <button onClick={() => speakNotice(selectedNotice.title, selectedNotice.message)}
                        className={`flex items-center justify-center h-5 w-5 rounded border cursor-pointer ${
                          isSpeaking ? 'bg-command-accent/15 border-command-accent/30 text-command-accent' : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-505 hover:text-gray-750 dark:hover:text-gray-250'}`}
                        title={isSpeaking ? 'Stop Reading' : 'Read Aloud'}>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                      </button>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mt-1 leading-snug"><TranslatedText text={selectedNotice.title} /></h3>
                  </div>
                </div>
                <button onClick={() => { stopSpeaking(); setSelectedNotice(null); }}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                  <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4 flex-1">
                <div className="rounded-xl border border-gray-150 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] p-4 sm:p-5 leading-relaxed text-sm text-gray-750 dark:text-gray-250">
                  <p className="whitespace-pre-line text-sm" key={`modal-${selectedNotice.id}-${lang}`}>
                    <span className="lang-flip-enter inline-block"><TranslatedText text={selectedNotice.message} /></span>
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-450 dark:text-gray-500 border-t border-gray-100 dark:border-white/5 pt-3">
                  <span>{new Date(selectedNotice.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}</span>
                  <span>Category: <strong className="capitalize text-gray-700 dark:text-gray-300">{selectedNotice.type}</strong></span>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-5">
                <button onClick={(e) => { dismiss(e, selectedNotice.id); stopSpeaking(); setSelectedNotice(null); }}
                  className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
                  Dismiss Notice
                </button>
                {selectedNotice.type === 'traffic' && location.pathname !== '/congestion' && (
                  <button onClick={() => { stopSpeaking(); deepLink(selectedNotice); }}
                    className="px-4 py-2 bg-[#5E8599] hover:bg-[#5E8599]/90 rounded-xl text-xs font-semibold text-white hover:scale-[1.01] active:scale-100 cursor-pointer transition-all">
                    Avoid Congestion
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ LIST MODAL ═══════ */}
      {isListViewOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-xl flex flex-col max-h-[80vh] overflow-hidden">

            <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-white/5 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {lang === 'en' ? 'Active System Alerts' : lang === 'hi' ? 'सक्रिय सिस्टम अलर्ट' : 'ಸಕ್ರಿಯ ಸಿಸ್ಟಮ್ ಅಲರ್ಟ್‌ಗಳು'}
                </h3>
                <p className="text-[11px] text-gray-450 dark:text-gray-500 mt-0.5">
                  {lang === 'en' ? 'Live traffic updates and official government circulars.' : lang === 'hi' ? 'लाइव ट्रैफ़िक अपडेट और आधिकारिक सरकारी सूचनाएँ।' : 'ಲೈವ್ ದಟ್ಟಣೆ ನವೀಕರಣಗಳು ಮತ್ತು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಪ್ರಕಟಣೆಗಳು.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleLang}
                  className="flex items-center h-6 rounded border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 text-[10px] font-bold text-gray-700 dark:text-gray-300">
                  <span>{lang.toUpperCase()}</span>
                </button>
                <button onClick={() => setIsListViewOpen(false)}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                  <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1.5 py-1">
              {activeNotices.map((n) => {
                const nTh = getTheme(n);
                return (
                  <div key={n.id} className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 rounded-xl border ${nTh.bg} border-l-4 ${nTh.accent} transition-all`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border mt-0.5 ${nTh.badge}`}>
                        {n.type === 'traffic' ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-550 dark:text-gray-400">{n.source}</span>
                          <span className={`text-[8px] px-1.5 rounded border font-semibold uppercase ${n.urgency === 'high' ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'}`}>{n.urgency}</span>
                          <span className="text-[9px] text-gray-450 dark:text-gray-500">• {new Date(n.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mt-1"><TranslatedText text={n.title} /></h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed"><TranslatedText text={n.message} /></p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col justify-end gap-2 shrink-0 border-t sm:border-t-0 border-gray-150 dark:border-white/5 pt-2 sm:pt-0">
                      {n.type === 'traffic' && location.pathname !== '/congestion' && (
                        <button onClick={() => deepLink(n)} className="px-3 py-1.5 bg-[#5E8599]/15 hover:bg-[#5E8599] text-[#5E8599] hover:text-white rounded-lg text-[10px] font-semibold cursor-pointer text-center transition-all">
                          {lang === 'en' ? 'View Map' : 'नक्शा'}
                        </button>
                      )}
                      <button onClick={(e) => dismiss(e, n.id)} className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg text-[10px] font-semibold text-gray-550 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer text-center">
                        {lang === 'en' ? 'Dismiss' : 'खारिज'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-3 border-t border-gray-100 dark:border-white/5 pt-3 shrink-0 text-xs text-gray-500 dark:text-gray-400">
              <span>{lang === 'en' ? 'Active alerts' : 'सक्रिय अलर्ट'}: {activeNotices.length}</span>
              <button onClick={() => { localStorage.removeItem('margsense_dismissed_notices'); setDismissedIds([]); }}
                className="text-command-accent hover:underline cursor-pointer font-bold">
                {lang === 'en' ? 'Reset All Dismissed' : 'सभी खारिज रीसेट करें'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
