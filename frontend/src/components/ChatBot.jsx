import { useState, useRef, useEffect } from 'react';
import client from '../api/client';

export default function ChatBot({ context = 'dashboard' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    if (context === 'login') {
      return [
        { role: 'assistant', content: 'Hello! I am the मार्ग Sense Public Assistant. How can I help you learn about मार्ग Sense or access your account today?' }
      ];
    }
    return [
      { role: 'assistant', content: 'Hello! I am the मार्ग Sense Command Center Assistant. How can I help you today?' }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const baseURL = client.defaults.baseURL || '/api';
      const response = await fetch(`${baseURL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(client.defaults.headers.common.Authorization
            ? { 'Authorization': client.defaults.headers.common.Authorization }
            : {}),
        },
        body: JSON.stringify({ message: userMessage, stream: true, context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let accumulatedText = '';
      let hasAddedAssistantMessage = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          accumulatedText += chunk;

          if (!hasAddedAssistantMessage) {
            hasAddedAssistantMessage = true;
            setMessages(prev => [...prev, { role: 'assistant', content: accumulatedText }]);
          } else {
            setMessages(prev => {
              const updated = [...prev];
              if (updated.length > 0) {
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulatedText
                };
              }
              return updated;
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to get AI response:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error while processing your request. Please ensure the backend is running and the Gemini API key is configured.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[9999] cursor-pointer group select-none transition-all duration-300 active:scale-95 focus:outline-none"
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? (
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#5E8599] to-[#8FAEB9] text-white shadow-[0_4px_20px_rgba(94,133,153,0.4)] flex items-center justify-center transition-all duration-300 hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : (
          <div className="relative w-[78px] h-[78px] flex items-center justify-center transition-all duration-300">
            {/* Pulsing glow ring for popping effect */}
            <span className="absolute inset-2 rounded-full bg-[#5E8599] opacity-20 group-hover:opacity-40 animate-ping pointer-events-none"></span>
            
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative filter drop-shadow-[0_4px_12px_rgba(94,133,153,0.35)] group-hover:drop-shadow-[0_8px_18px_rgba(94,133,153,0.5)] group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300"
            >
              {/* Speech bubble pointer / tail */}
              <path
                d="M 72 72 C 77 77, 82 85, 84 90 C 81 81, 80 76, 79 70 Z"
                className="fill-[#5E8599] stroke-[#5E8599]"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              
              {/* Main outer circle */}
              <circle
                cx="47"
                cy="47"
                r="41"
                className="fill-[#FAF5F5] dark:fill-stone-900 stroke-[#5E8599]"
                strokeWidth="3.5"
              />

              {/* Clip path for contents inside circle */}
              <defs>
                <clipPath id="circle-inner-clip">
                  <circle cx="47" cy="47" r="39.2" />
                </clipPath>
              </defs>

              {/* Clipped group for road */}
              <g clipPath="url(#circle-inner-clip)">
                {/* Road background */}
                <path
                  d="M -10 88 C 25 71, 55 69, 90 73 L 95 110 L -10 110 Z"
                  className="fill-[#8A9E85] dark:fill-[#4A5D46]"
                />
                {/* Road left boundary/curb */}
                <path
                  d="M -10 88 C 25 71, 55 69, 90 73"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.5"
                />
                {/* Road center dashed line */}
                <path
                  d="M -5 96 C 28 80, 56 78, 85 82"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeDasharray="5,5"
                  fill="none"
                  opacity="0.8"
                />
              </g>

              {/* Traffic light pole */}
              <rect
                x="26"
                y="57"
                width="2.5"
                height="17"
                className="fill-[#737373] dark:fill-[#525252]"
                rx="0.5"
              />
              {/* Traffic light housing */}
              <rect
                x="21.5"
                y="29"
                width="11.5"
                height="29"
                rx="3.5"
                className="fill-[#525252] dark:fill-[#303030]"
              />
              {/* Traffic lights */}
              <circle cx="27.25" cy="34" r="3.2" className="fill-[#EF4444]" />
              <circle cx="27.25" cy="43.5" r="3.2" className="fill-[#F59E0B]" />
              <circle cx="27.25" cy="53" r="3.2" className="fill-[#10B981]" />

              {/* Chat bubble outline */}
              <path
                d="M 44 36 H 70 C 73.3 36, 76 38.7, 76 42 V 54 C 76 57.3, 73.3 60, 70 60 H 60.5 L 59 69 L 55.5 60 H 44 C 40.7 60, 38 57.3, 38 54 V 42 C 38 38.7, 40.7 36, 44 36 Z"
                className="fill-white dark:fill-stone-800 stroke-[#5E8599]"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />

              {/* Three dots inside chat bubble */}
              <circle cx="47.5" cy="48" r="2.2" className="fill-[#5E8599]" />
              <circle cx="57" cy="48" r="2.2" className="fill-[#5E8599]" />
              <circle cx="66.5" cy="48" r="2.2" className="fill-[#5E8599]" />
            </svg>
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 h-[500px] bg-white dark:bg-gray-950 border border-gray-150 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5E8599] to-[#4A6C7D] p-4 text-white flex items-center gap-3 shadow-sm">
            <div className="bg-white/20 p-2 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold">मार्ग Sense</h3>
              <p className="text-xs text-white/80">
                {context === 'login' ? 'Public Assistant' : 'Command Center Assistant'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/30">
            {messages.map((msg, idx) => {
              const isError = msg.content.includes('[Error:');
              const cleanContent = isError 
                ? msg.content.replace('[Error: ', '').replace('[Error:', '').replace(']', '') 
                : msg.content;
              return (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-[#5E8599] text-white rounded-tr-none'
                        : isError
                        ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-tl-none shadow-sm'
                        : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-200 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {cleanContent}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 text-gray-500 max-w-[80%] p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#5E8599]/50 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#5E8599]/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-[#5E8599]/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-3 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={context === 'login' ? 'Ask about login or access...' : 'Ask about live congestion...'}
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#5E8599] text-gray-800 dark:text-gray-200 transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-[#5E8599] hover:bg-[#4A6C7D] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

