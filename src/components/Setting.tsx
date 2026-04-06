import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Settings, Building2, Phone, MapPin, Save, Database, Download } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/utils';

interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
}

export function Setting() {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: '',
    address: '',
    phone: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'company'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as CompanySettings);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/company'));
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'company'), settings);
      alert('Settings saved successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/company');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = () => {
    const data = JSON.stringify(settings);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glowprofit_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-slate-600" />
          Company Information
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Company Name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input required type="text" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <textarea rows={3} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="pt-8 border-t border-slate-100 space-y-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-slate-600" />
          Data Management
        </h2>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Backup Data</h3>
            <p className="text-sm text-slate-500">Download your company settings and configuration.</p>
          </div>
          <button
            onClick={handleBackup}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-5 h-5" />
            Download JSON
          </button>
        </div>
      </div>
    </div>
  );
}
