import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { FileText, Calendar, BarChart3, ArrowUpCircle, ArrowDownCircle, Calculator, Filter } from 'lucide-react';
import { handleFirestoreError, OperationType, formatMMK, cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, startOfDay, endOfDay, subMonths, startOfYear } from 'date-fns';

interface ReportEntry {
  date: string;
  category: 'Sales' | 'Expense' | 'Inventory Add' | 'Repurchase';
  amount: number;
}

export function FinancialReport() {
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [viewType, setViewType] = useState<'daily' | 'monthly'>('daily');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'purchases'));

    return () => {
      unsubSales();
      unsubExpenses();
      unsubPurchases();
    };
  }, []);

  const aggregatedData = useMemo(() => {
    const entries: ReportEntry[] = [
      ...sales.map(s => ({
        date: s.date,
        category: 'Sales' as const,
        amount: (s.subtotal || (s.totalAmount - (s.deliveryFees || 0)))
      })),
      ...expenses.map(e => ({
        date: e.date,
        category: 'Expense' as const,
        amount: e.amount
      })),
      ...purchases.map(p => ({
        date: p.date,
        category: 'Repurchase' as const, // Purchases are treated as Repurchase/Inventory Add
        amount: p.totalAmount
      }))
    ];

    if (viewType === 'daily') {
      const days = eachDayOfInterval({
        start: parseISO(dateRange.start),
        end: parseISO(dateRange.end)
      });

      return days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const daySales = entries.filter(e => e.category === 'Sales' && e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0);
        const dayExpenses = entries.filter(e => e.category === 'Expense' && e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0);
        const dayPurchases = entries.filter(e => e.category === 'Repurchase' && e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0);
        
        return {
          label: format(day, 'MMM d, yyyy'),
          sales: daySales,
          expense: dayExpenses,
          repurchase: dayPurchases,
          netBalance: daySales - (dayExpenses + dayPurchases)
        };
      }).reverse();
    } else {
      // Monthly view - last 12 months
      const months = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), i)).reverse();
      
      return months.map(month => {
        const monthStr = format(month, 'yyyy-MM');
        const monthSales = entries.filter(e => e.category === 'Sales' && e.date.startsWith(monthStr)).reduce((sum, e) => sum + e.amount, 0);
        const monthExpenses = entries.filter(e => e.category === 'Expense' && e.date.startsWith(monthStr)).reduce((sum, e) => sum + e.amount, 0);
        const monthPurchases = entries.filter(e => e.category === 'Repurchase' && e.date.startsWith(monthStr)).reduce((sum, e) => sum + e.amount, 0);

        return {
          label: format(month, 'MMMM yyyy'),
          sales: monthSales,
          expense: monthExpenses,
          repurchase: monthPurchases,
          netBalance: monthSales - (monthExpenses + monthPurchases)
        };
      }).reverse();
    }
  }, [sales, expenses, purchases, viewType, dateRange]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            Financial Aggregation Report
          </h2>
          <p className="text-slate-500 text-sm mt-1">Automated daily and monthly financial summaries.</p>
        </div>
        
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewType('daily')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              viewType === 'daily' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Daily
          </button>
          <button
            onClick={() => setViewType('monthly')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              viewType === 'monthly' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Monthly
          </button>
        </div>
      </div>

      {viewType === 'daily' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Range:</span>
          </div>
          <input
            type="date"
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{viewType === 'daily' ? 'Date' : 'Month'}</th>
                <th className="px-6 py-4 text-xs font-bold text-emerald-600 uppercase tracking-wider text-right">Sales (+)</th>
                <th className="px-6 py-4 text-xs font-bold text-rose-600 uppercase tracking-wider text-right">Expense (-)</th>
                <th className="px-6 py-4 text-xs font-bold text-amber-600 uppercase tracking-wider text-right">Repurchase (-)</th>
                <th className="px-6 py-4 text-xs font-bold text-indigo-600 uppercase tracking-wider text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aggregatedData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">{row.label}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">{formatMMK(row.sales)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-rose-600">{formatMMK(row.expense)}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-amber-600">{formatMMK(row.repurchase)}</td>
                  <td className={cn(
                    "px-6 py-4 text-right text-sm font-black",
                    row.netBalance >= 0 ? "text-indigo-600" : "text-rose-600"
                  )}>
                    {formatMMK(row.netBalance)}
                  </td>
                </tr>
              ))}
              {aggregatedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No data found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-100">
          <div className="flex items-center justify-between mb-4">
            <Calculator className="w-6 h-6 opacity-80" />
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Total Period Sales</span>
          </div>
          <p className="text-3xl font-black">{formatMMK(aggregatedData.reduce((sum, r) => sum + r.sales, 0))}</p>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <ArrowDownCircle className="w-6 h-6 text-rose-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Outflow</span>
          </div>
          <p className="text-3xl font-black text-slate-900">
            {formatMMK(aggregatedData.reduce((sum, r) => sum + r.expense + r.repurchase, 0))}
          </p>
          <p className="text-xs text-slate-500 mt-1">Expenses + Repurchases</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <Calculator className="w-6 h-6 text-indigo-600" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Period Net Balance</span>
          </div>
          <p className={cn(
            "text-3xl font-black",
            aggregatedData.reduce((sum, r) => sum + r.netBalance, 0) >= 0 ? "text-indigo-600" : "text-rose-600"
          )}>
            {formatMMK(aggregatedData.reduce((sum, r) => sum + r.netBalance, 0))}
          </p>
        </div>
      </div>
    </div>
  );
}
