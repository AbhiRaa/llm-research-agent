import { useState, useEffect } from 'react';

export default function TypingIndicator({ isVisible }: { isVisible: boolean }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isVisible) {
      setDots('');
      return;
    }

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm px-4 py-2">
      <div className="w-6 h-6 bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-300 dark:to-slate-400 rounded-lg flex items-center justify-center">
        <div className="w-2 h-2 bg-white dark:bg-slate-900 rounded-full" />
      </div>
      <span>AI is typing{dots}</span>
    </div>
  );
}