import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Database, Download, History, ShieldCheck, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { handleFirestoreError, OperationType, formatMMK } from '../lib/utils';
import { format } from 'date-fns';

interface BackupRecord {
  id: string;
  timestamp: any;
  collections: string[];
  totalRecords: number;
  status: 'success' | 'failed';
}

export function Backup() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupRecord | null>(null);

  const collectionsToBackup = [
    'products',
    'productMaster',
    'categories',
    'suppliers',
    'customers',
    'sales',
    'purchases',
    'expenses'
  ];

  useEffect(() => {
    const q = query(collection(db, 'backups'), orderBy('timestamp', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BackupRecord));
      setBackups(records);
      if (records.length > 0) {
        setLastBackup(records[0]);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'backups'));
    return () => unsub();
  }, []);

  const performBackup = async () => {
    setIsBackingUp(true);
    try {
      const backupData: any = {
        timestamp: serverTimestamp(),
        data: {},
        totalRecords: 0,
        collections: collectionsToBackup,
        status: 'success'
      };

      for (const colName of collectionsToBackup) {
        const snapshot = await getDocs(collection(db, colName));
        backupData.data[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        backupData.totalRecords += snapshot.docs.length;
      }

      await addDoc(collection(db, 'backups'), backupData);
      alert('Backup completed successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'backups');
      alert('Backup failed. Please check console for details.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const downloadBackup = (backup: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup.data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `glowprofit_backup_${format(backup.timestamp?.toDate() || new Date(), 'yyyyMMdd_HHmm')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-8 h-8 text-indigo-600" />
            Database Backup & Recovery
          </h1>
          <p className="text-slate-500 text-sm mt-1">Protect your data with automated and manual backups.</p>
        </div>
        <button 
          onClick={performBackup}
          disabled={isBackingUp}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-indigo-100 font-semibold"
        >
          {isBackingUp ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {isBackingUp ? 'Backing up...' : 'Backup Now'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-bold text-indigo-900">Backup Status</h3>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-indigo-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Auto-backup: Every 5 hours
            </p>
            <p className="text-sm text-indigo-700 flex items-center gap-2">
              <History className="w-4 h-4" />
              Last Backup: {lastBackup?.timestamp ? format(lastBackup.timestamp.toDate(), 'MMM d, h:mm a') : 'Never'}
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Database className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-emerald-900">Data Coverage</h3>
          </div>
          <p className="text-sm text-emerald-700">
            Backing up {collectionsToBackup.length} collections including Inventory, Sales, CRM, and Expenses.
          </p>
        </div>

        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-bold text-amber-900">Recovery Note</h3>
          </div>
          <p className="text-sm text-amber-700">
            Backups are stored securely in Firestore. You can also download them as JSON for local storage.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Recent Backups</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date & Time</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Records</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {backup.timestamp ? format(backup.timestamp.toDate(), 'MMM d, yyyy HH:mm:ss') : 'Processing...'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{backup.totalRecords} items</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      backup.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => downloadBackup(backup)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Download JSON"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No backups found. Perform your first backup now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
