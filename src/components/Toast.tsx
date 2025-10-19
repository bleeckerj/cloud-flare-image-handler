'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Toast = { id: string; message: string };

const ToastContext = createContext<{
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: string) => void;
} | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    const t = { id, message };
    setToasts(prev => [...prev, t]);
    setTimeout(() => dismiss(id), 3000);
  };

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <div aria-live="polite" className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-2">
        {toasts.map(t => (
          <div key={t.id} className="bg-gray-900 text-white px-4 py-2 rounded shadow">{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
