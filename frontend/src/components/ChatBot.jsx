import { useState, useRef, useEffect } from 'react';
import client from '../api/client';

export default function ChatBot({ context = 'dashboard' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    if (context === 'login') {
      return [
        { role: 'assistant', content: 'Hello! I am the ParkSense AI Public Assistant. How can I help you learn about ParkSense or access your account today?' }
      ];
    }
    return [
      { role: 'assistant', content: 'Hello! I am the ParkSense AI Command Center Assistant. How can I help you today?' }
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
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-[#BA5A5A] to-[#E28F8F] text-white rounded-full shadow-[0_4px_20px_rgba(186,90,90,0.4)] hover:shadow-[0_6px_25px_rgba(186,90,90,0.6)] hover:scale-110 transition-all z-[9999] flex items-center justify-center cursor-pointer group"
        aria-label="Toggle AI Assistant"
      >
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 relative z-10 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 h-[500px] bg-white dark:bg-gray-950 border border-gray-150 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#BA5A5A] to-[#A04848] p-4 text-white flex items-center gap-3 shadow-sm">
            <div className="bg-white/20 p-2 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold">ParkSense AI</h3>
              <p className="text-xs text-white/80">
                {context === 'login' ? 'Public Assistant' : 'Command Center Assistant'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/30">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-[#BA5A5A] text-white rounded-tr-none'
                      : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-200 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 text-gray-500 max-w-[80%] p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#BA5A5A]/50 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#BA5A5A]/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-[#BA5A5A]/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
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
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#BA5A5A] text-gray-800 dark:text-gray-200 transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-[#BA5A5A] hover:bg-[#A04848] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
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

