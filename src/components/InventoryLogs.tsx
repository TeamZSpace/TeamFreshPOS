import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { History as HistoryIcon, Search, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Tag, Clock, User, Package, ChevronRight } from 'lucide-react';
import { handleFirestoreError, OperationType, formatMMK, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface InventoryLog {
  id: string;
  product_id: string;
  productName: string;
  type: 'IN' | 'OUT';
  qty: number;
  referenceId?: string;
  reason: string;
  date: any;
  previousQty?: number;
  newQty?: number;
}

export function InventoryLogs() {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'inventory_logs'), orderBy('date', 'desc'), limit(500));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      } as InventoryLog)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_logs'));

    return () => unsub();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedLogs, requestSort, sortConfig } = useSortableData(filteredLogs, { key: 'date', direction: 'desc' });

  const exportToExcel = () => {
    const data = sortedLogs.map(log => ({
      'Date': format(log.date, 'yyyy-MM-dd HH:mm:ss'),
      'Product': log.productName,
      'Type': log.type,
      'Quantity': log.qty,
      'Previous Qty': log.previousQty || '-',
      'New Qty': log.newQty || '-',
      'Reason': log.reason,
      'Reference ID': log.referenceId || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InventoryLogs');
    XLSX.writeFile(wb, `inventory_logs_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 hover:opacity-100" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-pink-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-pink-600" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HistoryIcon className="w-8 h-8 text-pink-500" />
            Inventory Activity Logs
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track every stock movement and adjustment.</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-100 font-semibold"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span>Export Excel</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th onClick={() => requestSort('date')} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group">
                  <div className="flex items-center">Date{getSortIcon('date')}</div>
                </th>
                <th onClick={() => requestSort('productName')} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer group">
                  <div className="flex items-center">Product{getSortIcon('productName')}</div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Change</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       <Clock className="w-3 h-3" />
                       {format(log.date, 'MMM d, yyyy HH:mm')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-slate-900">{log.productName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-bold">
                    {log.type === 'IN' ? '+' : '-'}{log.qty}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {log.previousQty !== undefined && log.newQty !== undefined ? (
                      <div className="flex items-center gap-1">
                        <span>{log.previousQty}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="font-bold text-slate-700">{log.newQty}</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 italic">
                    {log.reason}
                  </td>
                </tr>
              ))}
              {sortedLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No activity logs found.
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
