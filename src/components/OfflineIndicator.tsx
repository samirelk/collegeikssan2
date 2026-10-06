import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-bold text-white shadow-lg border border-amber-500 animate-in fade-in"
      dir="rtl"
    >
      <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
      <span>وضع عدم الاتصال — يتم استخدام البيانات المخزنة محلياً</span>
    </div>
  );
};
