import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variants = {
    danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-100 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100 text-white',
    info: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 text-white',
  };

  const iconColors = {
    danger: 'text-rose-600 bg-rose-50',
    warning: 'text-amber-600 bg-amber-50',
    info: 'text-indigo-600 bg-indigo-50',
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-xl shrink-0", iconColors[variant])}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
            </div>
            <button onClick={onCancel} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        <div className="p-4 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={cn("px-6 py-2 text-sm font-bold rounded-xl transition-all shadow-lg", variants[variant])}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
