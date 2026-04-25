import { useState, useEffect } from 'react';

export interface UndoAction {
  message: string;
  undo: () => Promise<void>;
  duration?: number;
}

type Listener = (action: UndoAction | null) => void;
let currentAction: UndoAction | null = null;
const listeners: Set<Listener> = new Set();

export const notifyUndo = (action: UndoAction) => {
  currentAction = action;
  listeners.forEach(l => l(currentAction));
};

export const clearUndo = () => {
  currentAction = null;
  listeners.forEach(l => l(null));
};

export function useUndoNotification() {
  const [action, setAction] = useState<UndoAction | null>(currentAction);

  useEffect(() => {
    const listener = (newAction: UndoAction | null) => setAction(newAction);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return action;
}
