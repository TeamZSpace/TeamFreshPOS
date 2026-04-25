import React, { useEffect, useState, useCallback } from 'react';
import { RotateCcw, X, CheckCircle2 } from 'lucide-react';
import { useUndoNotification, clearUndo } from '../lib/notifications';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function UndoToast() {
  const action = useUndoNotification();
  const [progress, setProgress] = useState(100);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    if (action) {
      setProgress(100);
      const duration = action.duration || 5000;
      const interval = 100;
      const steps = duration / interval;
      const stepSize = 100 / steps;

      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev <= 0) {
            clearInterval(timer);
            clearUndo();
            return 0;
          }
          return prev - stepSize;
        });
      }, interval);

      return () => {
        clearInterval(timer);
      };
    }
  }, [action]);

  const handleUndo = useCallback(async () => {
    if (!action || isUndoing) return;
    setIsUndoing(true);
    try {
      await action.undo();
      clearUndo();
    } catch (err) {
      console.error('Failed to undo:', err);
    } finally {
      setIsUndoing(false);
    }
  }, [action, isUndoing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (action && !isUndoing) {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, isUndoing, handleUndo]);

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4"
        >
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-white/10 ring-1 ring-black/5">
            <div className="p-4 flex items-center gap-4">
              <div className="shrink-0 w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <RotateCcw className={cn("w-5 h-5 text-pink-400", isUndoing && "animate-spin")} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {action.message}
                </p>
                <button
                  onClick={handleUndo}
                  disabled={isUndoing}
                  className="text-pink-400 text-xs font-bold hover:text-pink-300 transition-colors uppercase tracking-wider mt-0.5 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUndoing ? 'Undoing...' : 'Undo'}
                  {!isUndoing && (
                    <span className="px-1 py-0.5 bg-white/10 rounded text-[10px] text-slate-400 font-normal normal-case">
                      Ctrl+Z
                    </span>
                  )}
                </button>
              </div>

              <button 
                onClick={clearUndo}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Progress bar */}
            <div className="h-1 bg-white/5 w-full">
              <motion.div 
                className="h-full bg-pink-500" 
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
