import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { TrendingUp, Download, Calendar, ArrowUpRight, ArrowDownRight, DollarSign, ShoppingBag, Receipt } from 'lucide-react';
import { cn, formatMMK, handleFirestoreError, OperationType } from '../lib/utils';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import * as XLSX from 'xlsx';

interface Sale {
  id: string;
  date: string;
  totalAmount: number;
  subtotal: number;
  items: { productId: string; quantity: number; price: number }[];
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
}

interface Product {
  id: string;
  name: string;
  landedCost: number;
}

export function Report() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setIsLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    return () => {
      unsubSales();
      unsubExpenses();
      unsubProducts();
    };
  }, []);

  const months = eachMonthOfInterval({
    start: subMonths(new Date(), 11),
    end: new Date()
  }).reverse();

  const currentMonthSales = sales.filter(s => isSameMonth(new Date(s.date), selectedMonth));
  const currentMonthExpenses = expenses.filter(e => isSameMonth(new Date(e.date), selectedMonth));

  const totalRevenue = currentMonthSales.reduce((sum, s) => sum + (s.subtotal || s.totalAmount), 0);
  const totalExpenses = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Calculate Cost of Goods Sold (COGS)
  const cogs = currentMonthSales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      const cost = product ? product.landedCost : 0;
      return itemSum + (cost * item.quantity);
    }, 0);
  }, 0);

  const grossProfit = totalRevenue - cogs;
  const netProfit = grossProfit - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const exportToExcel = () => {
    const reportData = [
      ['Monthly Financial Report', format(selectedMonth, 'MMMM yyyy')],
      [],
      ['Metric', 'Amount'],
      ['Total Revenue', totalRevenue],
      ['Cost of Goods Sold (COGS)', cogs],
      ['Gross Profit', grossProfit],
      ['Total Operating Expenses', totalExpenses],
      ['Net Profit', netProfit],
      ['Profit Margin (%)', profitMargin.toFixed(2) + '%'],
      [],
      ['Sales Details'],
      ['Date', 'Order ID', 'Amount'],
      ...currentMonthSales.map(s => [format(new Date(s.date), 'yyyy-MM-dd'), s.id, s.totalAmount]),
      [],
      ['Expense Details'],
      ['Date', 'Category', 'Amount'],
      ...currentMonthExpenses.map(e => [format(new Date(e.date), 'yyyy-MM-dd'), e.category, e.amount])
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
    
    // Note: Standard xlsx library doesn't support cell alignment in community version.
    // We are providing the data as requested.
    
    XLSX.writeFile(wb, `Monthly_Report_${format(selectedMonth, 'yyyy_MM')}.xlsx`);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading report data...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <Calendar className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Monthly Performance</h2>
            <p className="text-sm text-slate-500">Financial summary and detailed breakdown</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
            value={selectedMonth.toISOString()}
            onChange={(e) => setSelectedMonth(new Date(e.target.value))}
          >
            {months.map(m => (
              <option key={m.toISOString()} value={m.toISOString()}>
                {format(m, 'MMMM yyyy')}
              </option>
            ))}
          </select>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Download className="w-5 h-5" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Revenue</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">Total Sales</p>
          <p className="text-2xl font-black text-slate-900">{formatMMK(totalRevenue)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-50 rounded-lg">
              <Receipt className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">Expenses</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">Total Costs</p>
          <p className="text-2xl font-black text-slate-900">{formatMMK(totalExpenses + cogs)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Profit</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">Net Income</p>
          <p className={cn(
            "text-2xl font-black",
            netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            {formatMMK(netProfit)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Margin</span>
          </div>
          <p className="text-sm text-slate-500 mb-1">Profitability</p>
          <p className="text-2xl font-black text-slate-900">{profitMargin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Financial Breakdown</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-600">Gross Revenue</span>
              <span className="font-bold text-slate-900">{formatMMK(totalRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-600">Cost of Goods (COGS)</span>
              <span className="font-bold text-rose-600">-{formatMMK(cogs)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-600 font-bold">Gross Profit</span>
              <span className="font-bold text-emerald-600">{formatMMK(grossProfit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-slate-600">Operating Expenses</span>
              <span className="font-bold text-rose-600">-{formatMMK(totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center pt-4">
              <span className="text-lg font-black text-slate-900">Net Profit</span>
              <span className={cn(
                "text-xl font-black",
                netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatMMK(netProfit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-900">Monthly Summary</h3>
          </div>
          <div className="p-6 flex flex-col items-center justify-center h-full min-h-[200px] text-center">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mb-4",
              netProfit >= 0 ? "bg-emerald-100" : "bg-rose-100"
            )}>
              {netProfit >= 0 ? (
                <ArrowUpRight className="w-10 h-10 text-emerald-600" />
              ) : (
                <ArrowDownRight className="w-10 h-10 text-rose-600" />
              )}
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">
              {netProfit >= 0 ? 'Profitable Month!' : 'Loss this Month'}
            </h4>
            <p className="text-sm text-slate-500 max-w-[250px]">
              {netProfit >= 0 
                ? `You've made a net profit of ${formatMMK(netProfit)} this month. Keep up the good work!`
                : `You've incurred a loss of ${formatMMK(Math.abs(netProfit))} this month. Review your expenses.`}
            </p>
          </div>
        </div>
      </div>
      
      {/* Product Sales Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Product Sales Performance</h3>
          <span className="text-xs text-slate-500 italic">Actual sales and profit for {format(selectedMonth, 'MMMM yyyy')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Units Sold</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Total Revenue</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Total COGS</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Total Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(product => {
                const productSales = currentMonthSales.reduce((acc, sale) => {
                  const item = sale.items.find(i => i.productId === product.id);
                  if (item) {
                    acc.units += item.quantity;
                    acc.revenue += item.quantity * item.price;
                    acc.cost += item.quantity * product.landedCost;
                  }
                  return acc;
                }, { units: 0, revenue: 0, cost: 0 });

                if (productSales.units === 0) return null;

                const profit = productSales.revenue - productSales.cost;

                return (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                    <td className="px-6 py-4 text-center text-slate-600 font-bold">{productSales.units}</td>
                    <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatMMK(productSales.revenue)}</td>
                    <td className="px-6 py-4 text-right text-rose-600">{formatMMK(productSales.cost)}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-black">{formatMMK(profit)}</td>
                  </tr>
                );
              }).filter(Boolean)}
              {products.every(p => !currentMonthSales.some(s => s.items.some(i => i.productId === p.id))) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No product sales recorded for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Centered Margin Table as requested */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Product Margin Analysis</h3>
          <span className="text-xs text-slate-500 italic">Margin column is centered as requested</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Landed Cost</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Selling Price</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Margin (%)</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Profit/Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(product => {
                const margin = product.sellingPrice - product.landedCost;
                const marginPercent = product.landedCost > 0 ? (margin / product.landedCost) * 100 : 0;
                return (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{formatMMK(product.landedCost)}</td>
                    <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatMMK(product.sellingPrice)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        margin > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      )}>
                        {marginPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold">{formatMMK(margin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
