import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function myanmarToEnglishNumerals(str: string): string {
  const myanmarNumerals = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return str.replace(/[၀-၉]/g, (match) => myanmarNumerals.indexOf(match).toString());
}

export function formatMMK(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Ks0';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MMK',
    minimumFractionDigits: 0,
  }).format(amount).replace('MMK', 'Ks');
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

import { auth } from '../firebase';
import { useState, useMemo } from 'react';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded = errMsg.toLowerCase().includes('quota') || 
                          errMsg.toLowerCase().includes('resource-exhausted') || 
                          errMsg.toLowerCase().includes('limit exceeded') ||
                          errMsg.toLowerCase().includes('exhausted');

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaExceeded) {
    console.warn('Firestore Quota Exceeded Warn: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-error', { 
      detail: { ...errInfo, isQuotaExceeded } 
    }));
  }

  // Only throw if it's NOT a quota exceeded error to prevent crashing snapshot listeners
  if (!isQuotaExceeded) {
    throw new Error(JSON.stringify(errInfo));
  }
}

export function saveToCache<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(`fs_cache_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save cache for ${key}`, e);
  }
}

export function getFromCache<T>(key: string, fallback: T[] = []): T[] {
  try {
    const cached = localStorage.getItem(`fs_cache_${key}`);
    return cached ? JSON.parse(cached) : fallback;
  } catch (e) {
    console.warn(`Failed to load cache for ${key}`, e);
    return fallback;
  }
}

export function saveDocToCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(`fs_cache_doc_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save doc cache for ${key}`, e);
  }
}

export function getDocFromCache<T>(key: string, fallback: T | null = null): T | null {
  try {
    const cached = localStorage.getItem(`fs_cache_doc_${key}`);
    return cached ? JSON.parse(cached) : fallback;
  } catch (e) {
    console.warn(`Failed to load doc cache for ${key}`, e);
    return fallback;
  }
}

export function useSortableData<T>(items: T[], config: { key: string; direction: 'asc' | 'desc' } | null = null) {
  const [sortConfig, setSortConfig] = useState(config);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
}
