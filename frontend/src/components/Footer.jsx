import React from 'react';
import { useTranslation } from '../context/LanguageContext';

export default function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full border-t border-gray-100 dark:border-white/10 bg-white/50 dark:bg-gray-950/50 py-4 backdrop-blur-sm shrink-0">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain rounded-md dark:bg-white dark:p-0.5" />
          <span className="font-semibold text-gray-700 dark:text-gray-300">{t('appTitle')}</span>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <span>{t('tagline')}</span>
        </div>
        <div className="text-center md:text-right font-medium">
          © {currentYear} {t('appTitle')}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
