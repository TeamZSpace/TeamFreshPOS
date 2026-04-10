import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, collection, addDoc, writeBatch } from 'firebase/firestore';
import { Settings, Building2, Phone, MapPin, Save, Database, Download, RefreshCw, CheckCircle2, Upload, DollarSign } from 'lucide-react';
import { handleFirestoreError, OperationType, myanmarToEnglishNumerals } from '../lib/utils';

interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
  openingCash: number;
}

export function Setting() {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: '',
    address: '',
    phone: '',
    openingCash: 20000000,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [seedStatus, setSeedStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.companyName) {
        await setDoc(doc(db, 'settings', 'company'), data);
        alert('Data imported successfully!');
      } else {
        alert('Invalid backup file format.');
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import data. Please check the file format.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSeedData = async () => {
    if (!window.confirm('This will add sample categories, suppliers, and products to your database. Continue?')) return;
    
    setIsSeeding(true);
    setSeedStatus('idle');
    try {
      // 1. Seed Categories
      const catRef = collection(db, 'categories');
      const cat1 = await addDoc(catRef, { name: 'Supplements' });
      const cat2 = await addDoc(catRef, { name: 'Skin Care' });
      const cat3 = await addDoc(catRef, { name: 'Vitamins' });
      const cat4 = await addDoc(catRef, { name: 'Herbal Tea' });

      // 2. Seed Suppliers
      const supRef = collection(db, 'suppliers');
      const sup1 = await addDoc(supRef, { 
        name: 'Glow Global Ltd', 
        contactPerson: 'John Doe', 
        phone: '09123456789', 
        email: 'contact@glowglobal.com' 
      });
      const sup2 = await addDoc(supRef, { 
        name: 'Nature Best Co.', 
        contactPerson: 'Jane Smith', 
        phone: '09987654321', 
        email: 'sales@naturebest.com' 
      });

      // 3. Seed Products
      const prodRef = collection(db, 'products');
      const today = new Date().toISOString().split('T')[0];
      
      const sampleProducts = [
        {
          name: 'Vitamin C 1000mg',
          categoryId: cat3.id,
          supplierId: sup1.id,
          landedCost: 15000,
          sellingPrice: 25000,
          margin: 10000,
          stock: 50,
          expiryDate: '2025-12-31',
          purchaseDate: today
        },
        {
          name: 'Hyaluronic Acid Serum',
          categoryId: cat2.id,
          supplierId: sup1.id,
          landedCost: 12000,
          sellingPrice: 22000,
          margin: 10000,
          stock: 30,
          expiryDate: '2026-06-30',
          purchaseDate: today
        },
        {
          name: 'Organic Green Tea',
          categoryId: cat4.id,
          supplierId: sup2.id,
          landedCost: 8000,
          sellingPrice: 15000,
          margin: 7000,
          stock: 100,
          expiryDate: '2025-08-15',
          purchaseDate: today
        },
        {
          name: 'Collagen Peptides',
          categoryId: cat1.id,
          supplierId: sup2.id,
          landedCost: 35000,
          sellingPrice: 55000,
          margin: 20000,
          stock: 15,
          expiryDate: '2026-01-20',
          purchaseDate: today
        }
      ];

      for (const product of sampleProducts) {
        await addDoc(prodRef, product);
      }

      setSeedStatus('success');
      setTimeout(() => setSeedStatus('idle'), 3000);
    } catch (err) {
      console.error('Seeding failed:', err);
      setSeedStatus('error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8 pb-12">
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
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                value={settings.phone} 
                onChange={e => setSettings({...settings, phone: myanmarToEnglishNumerals(e.target.value)})} 
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <textarea rows={3} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Opening Cash (MMK)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="number" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={settings.openingCash} onChange={e => setSettings({...settings, openingCash: parseFloat(e.target.value) || 0})} />
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900">Backup Data</h3>
              <p className="text-sm text-slate-500">Download your settings.</p>
            </div>
            <button
              onClick={handleBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download className="w-5 h-5" />
              Download JSON
            </button>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900">Import Data</h3>
              <p className="text-sm text-slate-500">Restore from backup.</p>
            </div>
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImport}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              {isImporting ? 'Importing...' : 'Upload JSON'}
            </button>
          </div>
        </div>

        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-indigo-900">Seed Sample Data</h3>
            <p className="text-sm text-indigo-600">Populate your database with initial categories, suppliers, and products.</p>
          </div>
          <button
            onClick={handleSeedData}
            disabled={isSeeding}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all shadow-sm ${
              seedStatus === 'success' 
                ? 'bg-green-500 text-white' 
                : seedStatus === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {isSeeding ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : seedStatus === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Database className="w-5 h-5" />
            )}
            {isSeeding ? 'Seeding...' : seedStatus === 'success' ? 'Success!' : seedStatus === 'error' ? 'Error' : 'Seed Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
