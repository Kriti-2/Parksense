import { useState, useEffect } from 'react';

const CityscapeSVG = () => (
  <img 
    src="/ChatGPT Image Jun 20, 2026, 04_25_20 PM.png" 
    alt="Bengaluru Cityscape" 
    className="w-full h-[145px] lg:h-[175px] object-contain object-right mix-blend-multiply" 
  />
);

const BullseyeIcon = ({ className = "h-7 w-7 text-[#D48A6F]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.5} />
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth={1.5} />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    <path d="M 3 3 L 10 10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    <path d="M 10 7 L 10 10 L 7 10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DataIcon = ({ className = "h-4 w-4 text-[#D48A6F]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
  </svg>
);

const ClockIcon = ({ className = "h-4 w-4 text-[#D48A6F]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ShieldIcon = ({ className = "h-4 w-4 text-[#D48A6F]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const UsersIcon = ({ className = "h-4 w-4 text-[#D48A6F]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const CapIcon = ({ className = "h-4.5 w-4.5 text-[#8A9E85]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M 4 10 L 20 10 L 21 12.5 L 3 12.5 Z" />
    <path d="M 5.5 10 C 5.5 6 18.5 6 18.5 10" stroke="currentColor" strokeWidth={2.5} />
    <circle cx="12" cy="11.2" r="1.2" fill="currentColor" />
  </svg>
);

const SmileyIcon = ({ className = "h-4 w-4 text-[#D48A6F]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MapPinIcon = ({ className = "h-4 w-4 text-[#8A9E85]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TrendingUpIcon = ({ className = "h-4 w-4 text-[#8A9E85]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const DatabaseIcon = ({ className = "h-4 w-4 text-[#8A9E85]" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

export default function About() {
  return (
    <div className="flex flex-col justify-between h-[calc(100vh-115px)] gap-4 lg:gap-6 text-left px-4 md:px-8 py-1.5 bg-white">
      
      {/* ── Header Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left text controls */}
        <div className="lg:col-span-7 space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#EBF2F5] px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-[#5E8599]">
              Platform Overview
            </span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider">v2.4 Live</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            About <span className="text-[#5E8599]">मार्ग Sense</span>
          </h2>

          <p className="text-xs sm:text-[13px] text-gray-500 font-medium leading-relaxed max-w-2xl" style={{ fontFamily: "'Inter', sans-serif" }}>
            The next-generation, AI-driven traffic congestion intelligence platform for Bengaluru. 
            Enabling traffic command centers and citizens to predict congestion, protect key corridors, and optimize mobility in real-time.
          </p>
        </div>

        {/* Right cityscape graphic */}
        <div className="lg:col-span-5 w-full flex justify-start lg:pl-10">
          <div className="max-w-[480px] lg:max-w-[520px] w-full lg:-ml-12">
            <CityscapeSVG />
          </div>
        </div>
      </div>

      {/* ── Middle Mission & Values Section ── */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
        {/* Left Side: Our Mission */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EBF2F5]">
            <BullseyeIcon className="h-6 w-6 text-[#D48A6F]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900 mb-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>Our Mission</h3>
            <p className="text-[9.5px] text-gray-500 leading-normal font-medium mb-1">
              Bengaluru loses crores daily to traffic congestion. <strong className="text-gray-900 font-semibold">मार्ग Sense</strong> transitions city transit enforcement from reactive complaint-handling to proactive intelligence-led operations.
            </p>
            <p className="text-[9.5px] text-gray-500 leading-normal font-medium">
              We analyze historical and live CCTV streams to calculate economic loss costs and optimize deployment.
            </p>
          </div>
        </div>

        {/* Right Side: 4 Value Cards */}
        <div className="lg:border-l lg:border-gray-100 lg:pl-4 grid grid-cols-2 gap-3">
          {/* Data-Driven */}
          <div className="flex gap-2">
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-[#EBF2F5]">
              <DataIcon className="h-4.5 w-4.5 text-[#D48A6F]" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>Data-Driven</h4>
              <p className="text-[9px] text-gray-400 font-medium leading-tight mt-0.5">
                AI/ML models trained on real world traffic & violation data.
              </p>
            </div>
          </div>

          {/* Real-Time Intelligence */}
          <div className="flex gap-2">
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-[#EBF2F5]">
              <ClockIcon className="h-4.5 w-4.5 text-[#D48A6F]" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>Real-Time Intelligence</h4>
              <p className="text-[9px] text-gray-400 font-medium leading-tight mt-0.5">
                Live monitoring and instant insights for faster decisions.
              </p>
            </div>
          </div>

          {/* Proactive Enforcement */}
          <div className="flex gap-2">
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-[#EBF2F5]">
              <ShieldIcon className="h-4.5 w-4.5 text-[#D48A6F]" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>Proactive Enforcement</h4>
              <p className="text-[9px] text-gray-400 font-medium leading-tight mt-0.5">
                Predict, prevent and reduce congestion before it happens.
              </p>
            </div>
          </div>

          {/* Built for Bengaluru */}
          <div className="flex gap-2">
            <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-[#EBF2F5]">
              <UsersIcon className="h-4.5 w-4.5 text-[#D48A6F]" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>Built for Bengaluru</h4>
              <p className="text-[9px] text-gray-400 font-medium leading-tight mt-0.5">
                Designed for the city's unique traffic patterns and challenges.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Citizens vs Officers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        
        {/* Left Side: For Citizens */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="relative overflow-hidden p-3 min-h-[82px]">
            <div className="max-w-[62%] flex items-start gap-3">
              {/* Left Badge circle */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EBF2F5]">
                <UsersIcon className="h-5.5 w-5.5 text-[#D48A6F]" />
              </div>
              {/* Middle text */}
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>For Citizens</h3>
                <p className="text-[9px] text-gray-500 font-medium leading-normal">
                  Helping citizens enjoy safer, smoother and more predictable journeys across Bengaluru.
                </p>
              </div>
            </div>
            {/* Right Illustration */}
            <img 
              src="/ChatGPT Image Jun 20, 2026, 04_25_31 PM.png" 
              alt="For Citizens" 
              className="absolute right-0 bottom-0 h-[80%] w-auto max-w-[42%] object-contain object-right-bottom mix-blend-multiply" 
            />
          </div>

          {/* Footer list benefits */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 py-1.5 text-center border-t border-gray-50">
            <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <ClockIcon className="h-3.5 w-3.5 text-[#D48A6F]" />
              <span>Smoother Commutes</span>
            </div>
            <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <ShieldIcon className="h-3.5 w-3.5 text-[#D48A6F]" />
              <span>Safer Roads</span>
            </div>
            <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <SmileyIcon className="h-3.5 w-3.5 text-[#D48A6F]" />
              <span>Better Urban Experience</span>
            </div>
          </div>
        </div>

        {/* Right Side: For Officers */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="relative overflow-hidden p-3 min-h-[82px]">
            <div className="max-w-[62%] flex items-start gap-3">
              {/* Left Badge circle */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF7F2]">
                <CapIcon className="h-5.5 w-5.5 text-[#8A9E85]" />
              </div>
              {/* Middle text */}
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>For Officers & Administration</h3>
                <p className="text-[9px] text-gray-500 font-medium leading-normal">
                  Empowering teams with the right insights to allocate resources efficiently and maximize impact.
                </p>
              </div>
            </div>
            {/* Right Illustration */}
            <img 
              src="/ChatGPT Image Jun 20, 2026, 04_25_43 PM.png" 
              alt="For Officers & Administration" 
              className="absolute right-0 bottom-0 h-[80%] w-auto max-w-[42%] object-contain object-right-bottom mix-blend-multiply" 
            />
          </div>

          {/* Footer list benefits */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 py-1.5 text-center border-t border-gray-50">
            <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <MapPinIcon className="h-3.5 w-3.5 text-[#8A9E85]" />
              <span>Smart Deployment</span>
            </div>
            <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <TrendingUpIcon className="h-3.5 w-3.5 text-[#8A9E85]" />
              <span>Higher Efficiency</span>
            </div>
            <div className="text-[8.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
              <DatabaseIcon className="h-3.5 w-3.5 text-[#8A9E85]" />
              <span>Data-Backed Decisions</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
