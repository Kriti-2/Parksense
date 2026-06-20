import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useTranslation, TranslatedText } from '../context/LanguageContext';

const CYCLE_DURATION = 8000; // ms between auto-cycle

export default function NoticesBanner() {
  const [notices, setNotices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
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

  // Language & HUD
  const { lang, changeLanguage } = useTranslation();
  const [isCrazyMode, setIsCrazyMode] = useState(() => {
    try {
      const s = localStorage.getItem('margsense_crazy_mode');
      return s !== null ? JSON.parse(s) : true;
    } catch {
      return true;
    }
  });
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const s = localStorage.getItem('margsense_mute_mode');
      return s !== null ? JSON.parse(s) : false;
    } catch {
      return false;
    }
  });

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

  // Interactive: expanded inline preview on hover
  const [isExpanded, setIsExpanded] = useState(false);

  // Progress bar for auto-cycle timer
  const cycleTimerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  // ── Web Audio Synth ──
  const playSynthSound = useCallback((type) => {
    if (isMuted) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.07);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
        osc.start(); osc.stop(ctx.currentTime + 0.07);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(480, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(); osc.stop(ctx.currentTime + 0.22);
      } else if (type === 'popup') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.04);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(990, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      }
    } catch { /* silent */ }
  }, [isMuted]);

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

  // ── Translation dictionary ──


  // ── Handlers ──
  const goNext = (e) => { e?.stopPropagation(); playSynthSound('click'); setCurrentIndex((p) => (p + 1) % activeNotices.length); };
  const goPrev = (e) => { e?.stopPropagation(); playSynthSound('click'); setCurrentIndex((p) => (p === 0 ? activeNotices.length - 1 : p - 1)); };

  const dismiss = (e, id) => {
    e?.stopPropagation();
    playSynthSound('success');
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem('margsense_dismissed_notices', JSON.stringify(next));
  };

  const toggleLang = () => {
    playSynthSound('click');
    const next = lang === 'en' ? 'hi' : lang === 'hi' ? 'kn' : 'en';
    changeLanguage(next);
  };

  const toggleHud = () => {
    const next = !isCrazyMode;
    setIsCrazyMode(next);
    playSynthSound('success');
    localStorage.setItem('margsense_crazy_mode', JSON.stringify(next));
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem('margsense_mute_mode', JSON.stringify(next));
    if (!next) {
      setTimeout(() => {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = 'sine';
          o.frequency.setValueAtTime(600, ctx.currentTime);
          g.gain.setValueAtTime(0.04, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          o.start(); o.stop(ctx.currentTime + 0.1);
        } catch { /* silent */ }
      }, 50);
    }
  };

  const deepLink = (notice) => {
    playSynthSound('success');
    setSelectedNotice(null);
    setIsListViewOpen(false);
    if (notice.type === 'traffic') navigate('/congestion');
  };

  // ── Bail if nothing to show ──
  if (activeNotices.length === 0) return null;
  const tr = translate(cur);
  const t = tr[lang] || tr['en']; // current language text

  // ── Theme ──
  const getTheme = (n) => {
    const h = n.urgency === 'high';
    if (n.type === 'traffic') return {
      border: h ? 'border-red-500/50' : 'border-amber-500/40',
      bg: h ? 'bg-red-500/[0.06]' : 'bg-amber-500/[0.04]',
      accent: h ? 'border-l-red-500' : 'border-l-amber-500',
      badge: h ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-amber-500/15 text-amber-400 border-amber-500/25',
      glow: h ? 'text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.35)]' : 'text-amber-300',
      dot: h ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]',
      progressBar: h ? 'bg-red-500' : 'bg-amber-500',
    };
    if (n.type === 'circular') return {
      border: h ? 'border-purple-500/50' : 'border-indigo-500/40',
      bg: h ? 'bg-purple-500/[0.06]' : 'bg-indigo-500/[0.04]',
      accent: h ? 'border-l-purple-500' : 'border-l-indigo-500',
      badge: h ? 'bg-purple-500/15 text-purple-400 border-purple-500/25' : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
      glow: h ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.35)]' : 'text-indigo-300',
      dot: h ? 'bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'bg-indigo-500 shadow-[0_0_10px_#6366f1]',
      progressBar: h ? 'bg-purple-500' : 'bg-indigo-500',
    };
    return {
      border: 'border-blue-500/40', bg: 'bg-blue-500/[0.04]',
      accent: 'border-l-blue-500',
      badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
      glow: 'text-blue-300', dot: 'bg-blue-500 shadow-[0_0_10px_#3b82f6]',
      progressBar: 'bg-blue-500',
    };
  };
  const th = getTheme(cur);

  return (
    <>
      {/* ═══════ MAIN BANNER ═══════ */}
      <div
        className={`relative overflow-hidden transition-all duration-500 border-b border-command-border/30
          ${isCrazyMode ? 'scan-overlay bg-black/95 font-mono' : 'bg-gradient-to-r from-command-panel/90 to-command-panel backdrop-blur-lg'}
          ${th.border} ${th.bg} border-l-4 ${th.accent}`}
        style={isCrazyMode ? { animation: 'holo-flicker 10s infinite ease-in-out' } : {}}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => { setIsPaused(false); setIsExpanded(false); }}
      >
        {/* HUD grid overlay */}
        {isCrazyMode && <div className="absolute inset-0 cyber-grid pointer-events-none" style={{ animation:'grid-breathe 5s infinite' }} />}

        {/* Laser scanline */}
        {isCrazyMode && (
          <div className="absolute left-0 right-0 h-[2px] z-10 pointer-events-none opacity-40"
            style={{ animation:'scanline-slide 3.5s infinite linear', background:'linear-gradient(90deg,transparent,#3b82f6,transparent)', boxShadow:'0 0 12px #3b82f6' }} />
        )}

        {/* Corner brackets */}
        {isCrazyMode && <>
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-command-muted/40 z-20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-command-muted/40 z-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-command-muted/40 z-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-command-muted/40 z-20 pointer-events-none" />
        </>}

        {/* Auto-cycle progress bar at the very bottom */}
        {activeNotices.length > 1 && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 z-30">
            <div 
              key={safeCurrentIndex}
              className={`h-full ${th.progressBar} opacity-70`}
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
        <div className="relative z-20 mx-auto max-w-7xl flex items-center justify-between gap-5 px-6 md:px-8 py-5 sm:py-6">

          {/* Left: live dot + type badge + text */}
          <div className="flex-1 flex items-center gap-3 overflow-hidden cursor-pointer min-w-0"
            onClick={() => { playSynthSound('popup'); setSelectedNotice(cur); }}>

            {/* Pulsing radar dot */}
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${th.dot}`} />
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${th.dot}`} />
            </span>

            {/* Type badge */}
            <span className={`hidden sm:flex h-8 items-center rounded-lg px-3 border text-xs font-black uppercase tracking-widest select-none shrink-0 ${th.badge}`}>
              {cur.type}
            </span>

            {/* Notice text — single language with flip animation */}
            <div className="flex-1 min-w-0 overflow-hidden" key={`${cur.id}-${lang}`}>
              <div className="lang-flip-enter flex items-center gap-2.5 text-base sm:text-lg font-semibold tracking-tight">
                {isCrazyMode && (
                  <span className="text-command-accent text-xs font-black shrink-0 uppercase">
                    [{lang.toUpperCase()}]&gt;
                  </span>
                )}
                <span className="text-xs font-black uppercase tracking-widest text-command-muted shrink-0">
                  {cur.source}
                </span>
                <span className="text-gray-500 text-lg">|</span>
                <span className={`font-extrabold truncate ${th.glow}`}><TranslatedText text={cur.title} /></span>
                <span className="hidden lg:inline text-gray-500">—</span>
                <span className="hidden lg:inline text-gray-300 truncate max-w-2xl font-normal text-sm"><TranslatedText text={cur.message} /></span>
              </div>
            </div>

            {/* Expand hint (visible on hover when paused) */}
            {isPaused && !isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); playSynthSound('popup'); }}
                className="shrink-0 text-xs font-black text-command-accent uppercase tracking-wider hover:underline cursor-pointer animate-pulse hidden md:inline-block"
              >
                {isCrazyMode ? '[ EXPAND ]' : '▼ Expand'}
              </button>
            )}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2.5 shrink-0">

            {/* Language toggle pill */}
            <button onClick={(e) => { e.stopPropagation(); toggleLang(); }}
              className="flex items-center h-9 rounded-xl border border-command-border/50 bg-command-bg/40 overflow-hidden cursor-pointer transition-all hover:border-command-accent/40 group px-3 py-1 text-xs font-black text-white"
              title="Switch Language">
              <span>{lang.toUpperCase()}</span>
            </button>

            {/* Voice Read Aloud button */}
            <button onClick={(e) => { e.stopPropagation(); speakNotice(cur.title, cur.message); }}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isSpeaking ? 'bg-command-accent/15 border-command-accent/40 text-command-accent shadow-[0_0_8px_rgba(59,130,246,0.25)]' 
                  : 'border-command-border/40 text-gray-400 hover:text-white hover:bg-white/5'}`}
              title={isSpeaking ? 'Stop Listening' : 'Listen to News'}>
              {isSpeaking ? (
                <div className="flex items-end gap-[2px] h-5 w-5 justify-center pb-1">
                  <span className="w-[3px] h-2 bg-command-accent rounded-full origin-bottom animate-[voiceWave_0.8s_infinite_ease-in-out]"></span>
                  <span className="w-[3px] h-3.5 bg-command-accent rounded-full origin-bottom animate-[voiceWave_0.8s_infinite_ease-in-out_0.2s]"></span>
                  <span className="w-[3px] h-2.5 bg-command-accent rounded-full origin-bottom animate-[voiceWave_0.8s_infinite_ease-in-out_0.4s]"></span>
                  <span className="w-[3px] h-4 bg-command-accent rounded-full origin-bottom animate-[voiceWave_0.8s_infinite_ease-in-out_0.1s]"></span>
                </div>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V9a9 9 0 00-18 0v10a2 2 0 002 2zm8-6v-4m-8 4v-4" />
                </svg>
              )}
            </button>

            {/* Nav arrows */}
            {activeNotices.length > 1 && (
              <div className="hidden md:flex items-center bg-command-bg/40 border border-command-border/40 rounded-xl p-1">
                <button onClick={goPrev} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs font-black text-gray-400 px-2 select-none font-mono">{safeCurrentIndex + 1}/{activeNotices.length}</span>
                <button onClick={goNext} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            {/* All notices button */}
            <button onClick={(e) => { e.stopPropagation(); playSynthSound('popup'); setIsListViewOpen(true); }}
              className="px-3.5 py-1.5 rounded-xl bg-command-accent/10 border border-command-accent/25 text-command-accent hover:bg-command-accent/20 text-xs font-black cursor-pointer uppercase tracking-wider">
              ALL ({activeNotices.length})
            </button>

            {/* Dismiss */}
            <button onClick={(e) => dismiss(e, cur.id)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer" title="Dismiss">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* ─── Interactive inline expand (shown on hover click) ─── */}
        {isExpanded && (
          <div className="expand-slide relative z-20 mx-auto max-w-7xl px-6 md:px-8 pb-4 pt-1">
            <div className={`rounded-xl border p-4 text-sm leading-relaxed
              ${isCrazyMode ? 'bg-black/80 border-command-accent/25 text-green-300 font-mono' : 'bg-command-bg/50 border-command-border/40 text-gray-200'}`}>
              {isCrazyMode && <div className="text-[9px] text-command-accent mb-1.5 uppercase font-bold tracking-widest select-none">&gt; DECRYPTED_FEED [{lang === 'en' ? 'ENGLISH' : 'HINDI'}] //</div>}
              <p className="text-xs sm:text-sm"><TranslatedText text={cur.message} /></p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-command-border/30 text-[10px] text-command-muted">
                <span>{new Date(cur.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <div className="flex gap-2">
                  {cur.type === 'traffic' && location.pathname !== '/congestion' && (
                    <button onClick={() => deepLink(cur)} className="text-command-accent font-bold hover:underline cursor-pointer">
                      {lang === 'en' ? '→ Avoid Congestion' : '→ भीड़ से बचें'}
                    </button>
                  )}
                  <button onClick={() => { playSynthSound('popup'); setSelectedNotice(cur); setIsExpanded(false); }} className="text-command-accent font-bold hover:underline cursor-pointer">
                    {lang === 'en' ? 'Full Details →' : 'पूर्ण विवरण →'}
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
        const selT = selTr[lang];
        const selTh = getTheme(selectedNotice);
        return (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className={`w-full max-w-xl rounded-2xl border p-6 sm:p-8 shadow-[0_0_60px_rgba(59,130,246,0.15)] relative overflow-hidden
              ${isCrazyMode ? 'border-command-accent/50 scan-overlay font-mono bg-black' : 'border-command-border bg-command-panel'}`}>

              {isCrazyMode && <>
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-command-accent" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-command-accent" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-command-accent" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-command-accent" />
              </>}

              <div className="flex items-start justify-between gap-4 mb-5 relative z-20">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl border ${selTh.badge}`}>
                    {selectedNotice.type === 'traffic' ? (
                      <svg className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : selectedNotice.type === 'circular' ? (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-widest text-command-muted">{selectedNotice.source}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${
                        selectedNotice.urgency === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        {selectedNotice.urgency}
                      </span>
                      {/* Language toggle inside modal */}
                      <button onClick={toggleLang}
                        className="flex items-center h-5 rounded border border-command-border/50 bg-command-bg/40 px-2 cursor-pointer hover:border-command-accent/40 text-[8px] font-black text-white">
                        <span>{lang.toUpperCase()}</span>
                      </button>

                      {/* Voice Read Aloud inside modal */}
                      <button onClick={() => speakNotice(selectedNotice.title, selectedNotice.message)}
                        className={`flex items-center justify-center h-5 w-5 rounded-full border cursor-pointer hover:border-command-accent/40 ${
                          isSpeaking ? 'bg-command-accent/15 border-command-accent/30 text-command-accent' : 'border-command-border/50 bg-command-bg/40 text-gray-400 hover:text-white'}`}
                        title={isSpeaking ? 'Stop Listening' : 'Listen'}>
                        {isSpeaking ? (
                          <div className="flex items-end gap-[1.5px] h-3 justify-center pb-[1px]">
                            <span className="w-[2px] h-2 bg-command-accent rounded-full origin-bottom animate-[voiceWave_0.8s_infinite_ease-in-out]"></span>
                            <span className="w-[2px] h-3 bg-command-accent rounded-full origin-bottom animate-[voiceWave_0.8s_infinite_ease-in-out_0.2s]"></span>
                            <span className="w-[2px] h-1.5 bg-command-accent rounded-full origin-bottom animate-[voiceWave_0.8s_infinite_ease-in-out_0.4s]"></span>
                          </div>
                        ) : (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V9a9 9 0 00-18 0v10a2 2 0 002 2zm8-6v-4m-8 4v-4" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <h3 className="text-lg font-extrabold text-white mt-1.5 uppercase tracking-tight"><TranslatedText text={selectedNotice.title} /></h3>
                  </div>
                </div>
                <button onClick={() => { playSynthSound('click'); stopSpeaking(); setSelectedNotice(null); }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4 relative z-20">
                <div className={`rounded-xl border p-5 leading-relaxed
                  ${isCrazyMode ? 'bg-black/90 border-command-accent/25 text-green-300 font-mono shadow-[inset_0_0_10px_rgba(59,130,246,0.08)]' : 'bg-command-bg/40 border-command-border/40 text-gray-200'}`}>
                  {isCrazyMode && <div className="text-[9px] text-command-accent mb-2 uppercase font-bold tracking-widest select-none">&gt; FEED_DECRYPT [{lang === 'en' ? 'ENGLISH' : 'HINDI'}] //</div>}
                  <p className="whitespace-pre-line text-sm" key={`modal-${selectedNotice.id}-${lang}`}>
                    <span className="lang-flip-enter inline-block"><TranslatedText text={selectedNotice.message} /></span>
                  </p>
                  {isCrazyMode && <div className="text-[9px] text-command-accent mt-3 uppercase font-bold tracking-widest select-none text-right">// END_FEED</div>}
                </div>

                <div className="flex items-center justify-between text-xs text-command-muted border-t border-command-border/30 pt-3">
                  <span>{new Date(selectedNotice.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}</span>
                  <span>{lang === 'en' ? 'Type' : 'प्रकार'}: <strong className="capitalize text-gray-300">{selectedNotice.type}</strong></span>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 relative z-20">
                <button onClick={(e) => { dismiss(e, selectedNotice.id); stopSpeaking(); setSelectedNotice(null); }}
                  className="px-5 py-2.5 border border-command-border rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer">
                  {lang === 'en' ? 'Dismiss Notice' : 'सूचना खारिज करें'}
                </button>
                {selectedNotice.type === 'traffic' && location.pathname !== '/congestion' && (
                  <button onClick={() => { stopSpeaking(); deepLink(selectedNotice); }}
                    className="px-5 py-2.5 bg-command-accent rounded-xl text-xs font-black text-white hover:bg-command-accent/90 shadow-lg shadow-command-accent/20 hover:scale-[1.02] cursor-pointer transition-transform">
                    {lang === 'en' ? 'AVOID CONGESTION →' : 'भीड़ से बचें →'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ LIST MODAL ═══════ */}
      {isListViewOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className={`w-full max-w-3xl rounded-2xl border p-6 sm:p-8 shadow-[0_0_60px_rgba(59,130,246,0.15)] flex flex-col max-h-[85vh] overflow-hidden
            ${isCrazyMode ? 'border-command-accent/50 scan-overlay font-mono bg-black' : 'border-command-border bg-command-panel'}`}>

            {isCrazyMode && <>
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-command-accent" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-command-accent" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-command-accent" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-command-accent" />
            </>}

            <div className="flex items-center justify-between mb-5 border-b border-command-border/40 pb-3 shrink-0 relative z-20">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  {lang === 'en' ? (isCrazyMode ? 'ACTIVE_SYSTEM_ALERTS' : 'All Active Notices') : lang === 'hi' ? (isCrazyMode ? 'सक्रिय_सिस्टम_अलर्ट' : 'सभी सक्रिय सूचनाएँ') : (isCrazyMode ? 'ಸಕ್ರಿಯ_ಸಿಸ್ಟಮ್_ಅಲರ್ಟ್‌ಗಳು' : 'ಎಲ್ಲಾ ಸಕ್ರಿಯ ಪ್ರಕಟಣೆಗಳು')}
                </h3>
                <p className="text-xs text-command-muted mt-0.5">
                  {lang === 'en' ? 'Live traffic updates and official government circulars.' : lang === 'hi' ? 'लाइव ट्रैफ़िक अपडेट और आधिकारिक सरकारी सूचनाएँ।' : 'ಲೈವ್ ದಟ್ಟಣೆ ನವೀಕರಣಗಳು ಮತ್ತು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಪ್ರಕಟಣೆಗಳು.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleLang}
                  className="flex items-center h-6 rounded border border-command-border/50 bg-command-bg/40 px-2 cursor-pointer hover:border-command-accent/40 text-[9px] font-black text-white">
                  <span>{lang.toUpperCase()}</span>
                </button>
                <button onClick={() => { playSynthSound('click'); setIsListViewOpen(false); }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 py-1 relative z-20">
              {activeNotices.map((n) => {
                const nTh = getTheme(n);
                const nTr = translate(n);
                const nT = nTr[lang];
                return (
                  <div key={n.id} className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 sm:p-5 rounded-xl border transition-all ${nTh.border} ${nTh.bg} border-l-4 ${nTh.accent}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${nTh.badge}`}>
                        {n.type === 'traffic' ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-wider text-command-muted">{n.source}</span>
                          <span className={`text-[8px] px-1.5 rounded border font-bold uppercase ${n.urgency === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{n.urgency}</span>
                          <span className="text-[10px] text-command-muted">• {new Date(n.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <h4 className="text-sm font-extrabold text-white mt-1"><TranslatedText text={n.title} /></h4>
                        <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isCrazyMode ? 'text-green-300/90' : 'text-gray-300'}`}><TranslatedText text={n.message} /></p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col justify-end gap-2 shrink-0 border-t sm:border-t-0 border-command-border/30 pt-2 sm:pt-0">
                      {n.type === 'traffic' && location.pathname !== '/congestion' && (
                        <button onClick={() => deepLink(n)} className="px-3 py-1.5 bg-command-accent/20 hover:bg-command-accent text-command-accent hover:text-white rounded-lg text-[10px] font-black cursor-pointer text-center transition-all">
                          {lang === 'en' ? 'View Map' : 'नक्शा'}
                        </button>
                      )}
                      <button onClick={(e) => dismiss(e, n.id)} className="px-3 py-1.5 border border-command-border rounded-lg text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer text-center">
                        {lang === 'en' ? 'Dismiss' : 'खारिज'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-4 border-t border-command-border/40 pt-3 shrink-0 text-xs text-command-muted relative z-20">
              <span>{lang === 'en' ? 'Active notices' : 'सक्रिय सूचनाएँ'}: {activeNotices.length}</span>
              <button onClick={() => { playSynthSound('success'); localStorage.removeItem('margsense_dismissed_notices'); setDismissedIds([]); }}
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
