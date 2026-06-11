import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { UndoToast } from './components/UndoToast';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Purchase } from './components/Purchase';
import { Sales } from './components/Sales';
import { Expense } from './components/Expense';
import { Categories } from './components/Categories';
import { CRM } from './components/CRM';
import { Supplier } from './components/Supplier';
import { Setting } from './components/Setting';
import { Report } from './components/Report';
import { ProductMaster } from './components/ProductMaster';
import { Backup } from './components/Backup';
import { AIStrategist } from './components/AIStrategist';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Receipt, Tags, Users, Truck, Settings, BarChart3, ClipboardList, Database, Heart, AlertTriangle } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/utils';

export type MenuType = 'Dashboard' | 'Inventory' | 'Purchase' | 'Sales' | 'Expense' | 'Categories' | 'CRM' | 'Supplier' | 'Setting' | 'Report' | 'ProductMaster' | 'Backup';

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [activeMenu, setActiveMenu] = useState<MenuType>('Dashboard');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [quotaError, setQuotaError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Close mobile menu when menu changes
    setIsMobileMenuOpen(false);
  }, [activeMenu]);

  useEffect(() => {
    // Listen to firestore-error global event
    const handleDbError = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.isQuotaExceeded) {
        setQuotaError(true);
      }
    };
    window.addEventListener('firestore-error', handleDbError);
    return () => window.removeEventListener('firestore-error', handleDbError);
  }, []);

  useEffect(() => {
    // Auto-backup logic (every 5 hours with local caching to conserve database quota)
    if (user) {
      const checkAndBackup = async () => {
        try {
          // Check localStorage first to avoid repeated queries on reload or dev mounts
          const lastBackupTimeStr = localStorage.getItem('last_backup_time');
          const fiveHoursInMs = 5 * 60 * 60 * 1000;
          if (lastBackupTimeStr) {
            const lastTime = parseInt(lastBackupTimeStr, 10);
            if (!isNaN(lastTime) && Date.now() - lastTime < fiveHoursInMs) {
              console.log('Skipping backup check: executed recently (cached in localStorage).');
              return;
            }
          }

          const q = query(collection(db, 'backups'), orderBy('timestamp', 'desc'), limit(1));
          const snapshot = await getDocs(q);
          let shouldBackup = false;
          
          if (snapshot.empty) {
            shouldBackup = true;
          } else {
            const lastBackup = snapshot.docs[0].data();
            const lastTime = lastBackup.timestamp?.toDate().getTime() || 0;
            if (Date.now() - lastTime > fiveHoursInMs) {
              shouldBackup = true;
            }
          }

          if (shouldBackup) {
            console.log('Starting automated 5-hour backup...');
            const collectionsToBackup = ['products', 'productMaster', 'categories', 'suppliers', 'customers', 'sales', 'purchases', 'expenses'];
            const backupData: any = {
              timestamp: serverTimestamp(),
              data: {},
              totalRecords: 0,
              collections: collectionsToBackup,
              status: 'success',
              isAuto: true
            };

            for (const colName of collectionsToBackup) {
              const colSnapshot = await getDocs(collection(db, colName));
              backupData.data[colName] = colSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              backupData.totalRecords += colSnapshot.docs.length;
            }

            await addDoc(collection(db, 'backups'), backupData);
            console.log('Automated backup completed.');
          }

          // Store last backup time in localStorage to skip checks for another 5 hours
          localStorage.setItem('last_backup_time', Date.now().toString());
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isQuota = errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('exhausted') || errMsg.toLowerCase().includes('limit');
          if (isQuota) {
            // Set backup time so we don't query backups for another 5 hours under quota
            localStorage.setItem('last_backup_time', Date.now().toString());
            setQuotaError(true);
          }
          handleFirestoreError(err, OperationType.CREATE, 'backups');
        }
      };

      // Run once on load, then every hour to check
      checkAndBackup();
      const interval = setInterval(checkAndBackup, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Initializing FreshPOS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const renderContent = () => {
    switch (activeMenu) {
      case 'Dashboard': return <Dashboard />;
      case 'Inventory': return <Inventory />;
      case 'Purchase': return <Purchase />;
      case 'Sales': return <Sales />;
      case 'Expense': return <Expense />;
      case 'Categories': return <Categories />;
      case 'CRM': return <CRM />;
      case 'Supplier': return <Supplier />;
      case 'Setting': return <Setting />;
      case 'Report': return <Report />;
      case 'ProductMaster': return <ProductMaster />;
      case 'Backup': return <Backup />;
      default: return <Dashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
        <Sidebar 
          activeMenu={activeMenu} 
          setActiveMenu={setActiveMenu} 
          isOpen={isMobileMenuOpen} 
          onClose={() => setIsMobileMenuOpen(false)} 
        />
        <main className="flex-1 overflow-y-auto h-screen p-2 sm:p-4">
          <div className="w-full">
            {quotaError && (
              <div id="quota_exceeded_banner" className="mb-6 mx-4 p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl flex flex-col md:flex-row gap-4 items-start justify-between shadow-sm animate-fade-in">
                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl flex-shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-base">Firestore Database Free-Tier Limit Reached</h4>
                    <p className="text-amber-800 text-sm mt-1 leading-relaxed">
                      FreshPOS is currently operating on its free-tier Firestore quota which permits 50,000 reads/day. Other users' heavy activity has temporarily reached this limit.
                    </p>
                    <p className="text-amber-700 text-xs mt-2 font-medium bg-white/60 inline-block px-2.5 py-1 rounded-lg">
                      🕒 Quota resets daily at midnight US Pacific Standard Time (~3:30 PM Myanmar Standard Time).
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <span className="text-amber-800 text-xs font-semibold">Want to prevent this issue?</span>
                      <a 
                        href="https://console.firebase.google.com/project/teamzpos/firestore/databases/ai-studio-f23c92d4-df24-4f6e-a31f-675d015a26da/data?openUpgradeDialog=true"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-xl transition-all border border-amber-300"
                      >
                        🚀 Open Firestore Upgrade Dialog
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 self-end md:self-start md:mt-2">
                  <button 
                    onClick={() => {
                      setQuotaError(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-100/50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-all"
                  >
                    Dismiss Notice
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all"
                  >
                    Refresh App
                  </button>
                </div>
              </div>
            )}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-4">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <div className="flex items-center gap-3 lg:hidden">
                  <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600 hover:text-pink-600 transition-colors"
                  >
                    <LayoutDashboard className="w-6 h-6" />
                  </button>
                  <div className="w-10 h-10 bg-pink-400 rounded-xl flex items-center justify-center shadow-lg shadow-pink-100">
                    <Heart className="w-6 h-6 text-white fill-current" />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">{activeMenu}</h1>
                  <p className="text-slate-500 mt-1">Manage your supplement and skin care shop effectively.</p>
                </div>
                <div className="sm:hidden">
                   <h1 className="text-xl font-bold tracking-tight text-slate-900">{activeMenu}</h1>
                </div>
              </div>
              <Auth />
            </header>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-12rem)] p-2 sm:p-4">
              {renderContent()}
            </div>
            <UndoToast />
            <AIStrategist />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
