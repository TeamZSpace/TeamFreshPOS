import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
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
import { FinancialReport } from './components/FinancialReport';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Receipt, Tags, Users, Truck, Settings, BarChart3, ClipboardList, Database } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/utils';

export type MenuType = 'Dashboard' | 'Inventory' | 'Purchase' | 'Sales' | 'Expense' | 'Categories' | 'CRM' | 'Supplier' | 'Setting' | 'Report' | 'ProductMaster' | 'Backup' | 'FinancialReport';

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [activeMenu, setActiveMenu] = useState<MenuType>('Dashboard');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    // Auto-backup logic (every 5 hours)
    if (user) {
      const checkAndBackup = async () => {
        try {
          const q = query(collection(db, 'backups'), orderBy('timestamp', 'desc'), limit(1));
          const snapshot = await getDocs(q);
          let shouldBackup = false;
          
          if (snapshot.empty) {
            shouldBackup = true;
          } else {
            const lastBackup = snapshot.docs[0].data();
            const lastTime = lastBackup.timestamp?.toDate().getTime() || 0;
            const fiveHoursInMs = 5 * 60 * 60 * 1000;
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
        } catch (err) {
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
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Initializing GlowProfit...</p>
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
      case 'FinancialReport': return <FinancialReport />;
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
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-4">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <div className="flex items-center gap-3 lg:hidden">
                  <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    <LayoutDashboard className="w-6 h-6" />
                  </button>
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Package className="w-6 h-6 text-white" />
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
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
