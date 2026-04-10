import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, doc } from 'firebase/firestore';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingBag, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { handleFirestoreError, OperationType, cn, formatMMK } from '../lib/utils';
import { format, subDays, isAfter } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Sale {
  id: string;
  subtotal?: number;
  deliveryFees?: number;
  totalAmount: number;
  date: string;
  items: { productId: string; quantity: number; price: number }[];
  orderNumber?: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  landedCost: number;
  sellingPrice: number;
}

interface Expense {
  id: string;
  amount: number;
  date: string;
}

interface Purchase {
  id: string;
  totalAmount: number;
}

interface Settings {
  openingCash: number;
}

export function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [settings, setSettings] = useState<Settings>({ openingCash: 20000000 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'purchases'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'company'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      }
    });

    setLoading(false);
    return () => {
      unsubSales();
      unsubProducts();
      unsubExpenses();
      unsubPurchases();
      unsubSettings();
    };
  }, []);

  // Calculations
  const totalSales = sales.reduce((sum, s) => sum + (s.subtotal || (s.totalAmount - (s.deliveryFees || 0))), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  const totalCOGS = sales.reduce((sum, sale) => {
    const saleCost = sale.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      return itemSum + ((product?.landedCost || 0) * item.quantity);
    }, 0);
    return sum + saleCost;
  }, 0);

  const grossProfit = totalSales - totalCOGS;
  const netProfit = grossProfit - totalExpenses;
  const inventoryValue = products.reduce((sum, p) => sum + (p.landedCost * p.stock), 0);
  const lowStockItems = products.filter(p => p.stock < 10);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySales = sales.filter(s => format(new Date(s.date), 'yyyy-MM-dd') === dateStr)
      .reduce((sum, s) => sum + (s.subtotal || (s.totalAmount - (s.deliveryFees || 0))), 0);
    return { name: format(date, 'MMM d'), sales: daySales };
  }).reverse();

  const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-xl", color)}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full",
            trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          )}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{formatMMK(value)}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Sales" value={totalSales} icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
        <StatCard title="COGS" value={totalCOGS} icon={Package} color="bg-slate-50 text-slate-600" />
        <StatCard title="Total Expenses" value={totalExpenses} icon={TrendingDown} color="bg-rose-50 text-rose-600" />
        <StatCard title="Net Profit" value={netProfit} icon={ShoppingBag} color="bg-amber-50 text-amber-600" />
        <StatCard title="Inventory Balance" value={inventoryValue} icon={Package} color="bg-slate-50 text-slate-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Sales Overview (Last 7 Days)</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-600 rounded-full" />
              <span className="text-xs text-slate-500 font-medium">Revenue</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7Days}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dx={-10} />
                <Tooltip 
                  formatter={(value: number) => [formatMMK(value), 'Sales']}
                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  itemStyle={{color: '#4f46e5', fontWeight: 'bold'}}
                />
                <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Inventory Value
            </h3>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">{formatMMK(inventoryValue)}</p>
                <p className="text-sm text-slate-500 font-medium">Current stock valuation</p>
              </div>
              <div className="bg-indigo-50 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              Low Stock Alerts
            </h3>
            <div className="space-y-3">
              {lowStockItems.length > 0 ? (
                lowStockItems.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-sm font-bold text-rose-900 truncate max-w-[150px]">{item.name}</span>
                    <span className="text-xs font-black bg-rose-200 text-rose-800 px-2 py-1 rounded-full">{item.stock} left</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400">All stock levels healthy</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Recent Sales</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Order</th>
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map(sale => (
                <tr key={sale.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4 font-mono text-xs font-bold text-slate-500">#{sale.orderNumber}</td>
                  <td className="py-4 text-sm text-slate-600">{format(new Date(sale.date), 'MMM d, yyyy')}</td>
                  <td className="py-4 text-right font-bold text-slate-900">{formatMMK(sale.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
