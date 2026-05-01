import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, doc } from 'firebase/firestore';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingBag, AlertCircle, ArrowUpRight, ArrowDownRight, FileSpreadsheet, RefreshCw, Calculator } from 'lucide-react';
import { handleFirestoreError, OperationType, cn, formatMMK } from '../lib/utils';
import { format, subDays, isAfter } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { exportAllToExcel } from '../lib/exportUtils';
import { getDocs } from 'firebase/firestore';

interface Sale {
  id: string;
  order_no?: string;
  date: string;
  subtotal?: number;
  gross_amount?: number;
  tax_amount?: number;
  net_amount?: number;
  deliveryFees?: number;
  total_amount: number;
  items: { product_id: string; qty: number; sold_price_snapshot: number; cost_price_snapshot?: number }[];
  profit?: number;
}

interface Product {
  id: string;
  name: string;
  total_stock: number;
  average_cost_price: number;
  current_selling_price: number;
  expiryDate?: string;
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
  const [loading, setLoading] = useState({
    sales: true,
    products: true,
    expenses: true,
    purchases: true,
    settings: true
  });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          total_amount: Number(data.total_amount || data.totalAmount || 0),
          subtotal: Number(data.subtotal || 0),
          gross_amount: Number(data.gross_amount || data.subtotal || 0),
          order_no: data.order_no || data.orderNumber
        } as Sale;
      }));
      setLoading(prev => ({ ...prev, sales: false }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(prev => ({ ...prev, products: false }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(prev => ({ ...prev, expenses: false }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
      setLoading(prev => ({ ...prev, purchases: false }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'purchases'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'company'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as Settings);
      }
      setLoading(prev => ({ ...prev, settings: false }));
    });

    return () => {
      unsubSales();
      unsubProducts();
      unsubExpenses();
      unsubPurchases();
      unsubSettings();
    };
  }, []);

  const isInitialLoading = Object.values(loading).some(l => l);

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Crunching your business data...</p>
      </div>
    );
  }

  // Calculations
  const totalSales = sales.reduce((sum, sale) => {
    // Preference: gross_amount -> subtotal -> calculated from items
    let revenue = 0;
    if (sale.gross_amount !== undefined && !isNaN(Number(sale.gross_amount))) {
      revenue = Number(sale.gross_amount);
    } else if (sale.subtotal !== undefined && !isNaN(Number(sale.subtotal))) {
      revenue = Number(sale.subtotal);
    } else {
      revenue = (sale.items || []).reduce((itemSum, item) => itemSum + (Number(item.sold_price_snapshot || 0) * Number(item.qty || 0)), 0);
    }
    return sum + (isNaN(revenue) ? 0 : revenue);
  }, 0);
  
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + Number((p as any).total_amount || p.totalAmount || 0), 0);
  
  const totalCOGS = sales.reduce((sum, sale) => {
    const saleCost = (sale.items || []).reduce((itemSum, item) => {
      const pid = item.product_id || (item as any).id;
      const product = products.find(p => p.id === pid);
      // Ensure we have a strictly numerical cost
      const costSnapshot = item.cost_price_snapshot !== undefined ? Number(item.cost_price_snapshot) : undefined;
      const productCost = product?.average_cost_price !== undefined ? Number(product.average_cost_price) : 0;
      
      const cost = costSnapshot !== undefined && !isNaN(costSnapshot) ? costSnapshot : productCost;
      const qty = Number(item.qty || 0);
      
      return itemSum + (cost * qty);
    }, 0);
    return sum + (isNaN(saleCost) ? 0 : saleCost);
  }, 0);

  const grossProfit = totalSales - totalCOGS;
  const netProfit = grossProfit - totalExpenses;
  const inventoryValue = products.reduce((sum, p) => sum + (Number(p.average_cost_price || 0) * Number(p.total_stock || 0)), 0);
  const lowStockItems = products.filter(p => Number(p.total_stock || 0) < 10);
  
  const expiringSoonCount = products.filter(p => {
    if (!p.expiryDate || !p.expiryDate.includes('/')) return false;
    try {
      const [month, year] = p.expiryDate.split('/');
      const expDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      return expDate.getTime() < new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
    } catch (e) {
      return false;
    }
  }).length;

  const handleMasterExport = async () => {
    setIsExporting(true);
    try {
      await exportAllToExcel(db);
    } catch (err) {
      alert('Failed to export master data. See console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySales = sales.filter(s => {
      try {
        const d = new Date(s.date);
        return !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === dateStr;
      } catch (e) {
        return false;
      }
    })
      .reduce((sum, s) => {
        // Preference: gross_amount -> subtotal -> calculated from items
        let rev = 0;
        if (s.gross_amount !== undefined && !isNaN(Number(s.gross_amount))) {
          rev = Number(s.gross_amount);
        } else if (s.subtotal !== undefined && !isNaN(Number(s.subtotal))) {
          rev = Number(s.subtotal);
        } else {
          rev = (s.items || []).reduce((itemSum, item) => itemSum + (Number(item.sold_price_snapshot || 0) * Number(item.qty || 0)), 0);
        }
        return sum + rev;
      }, 0);
    return { name: format(date, 'MMM d'), sales: daySales };
  }).reverse();

  const StatCard = ({ title, value, icon: Icon, color, trend, description }: any) => (
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
      {description && <p className="text-[10px] text-slate-400 mt-2 font-medium leading-tight">{description}</p>}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard Summary</h2>
          <p className="text-sm text-slate-500">Real-time business performance metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Formula Logic</span>
            <span className="text-[11px] text-slate-600 font-medium">Accrual Basis Accounting</span>
          </div>
          <button
            onClick={handleMasterExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-300 text-white rounded-xl font-semibold transition-all shadow-lg shadow-pink-100 group"
          >
            {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5 group-hover:scale-110 transition-transform" />}
            <span>{isExporting ? 'Exporting...' : 'Master Excel Export'}</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        <StatCard title="Total Sales" value={totalSales} icon={TrendingUp} color="bg-pink-50 text-pink-600" />
        <StatCard 
          title="COGS" 
          value={totalCOGS} 
          icon={Package} 
          color="bg-slate-50 text-slate-600" 
          description="Cost of Goods Sold: Total cost of units sold (Quantity × Cost Price)."
        />
        <StatCard title="Total Purchases" value={totalPurchases} icon={ShoppingBag} color="bg-blue-50 text-blue-600" />
        <StatCard title="Total Expenses" value={totalExpenses} icon={TrendingDown} color="bg-rose-50 text-rose-600" />
        <StatCard 
          title="Net Profit" 
          value={netProfit} 
          icon={DollarSign} 
          color="bg-emerald-50 text-emerald-600" 
          description="Revenue - COGS - Expenses. Real-time bottom line profit."
        />
        <StatCard title="Inventory Value" value={inventoryValue} icon={Package} color="bg-amber-50 text-amber-600" />
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-orange-600 uppercase">Alerts</span>
              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{expiringSoonCount + lowStockItems.length}</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Expiring/Low</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-slate-900 tracking-tight">{expiringSoonCount}</p>
            <span className="text-xs text-slate-400">expiring soon</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Sales Overview (Last 7 Days)</h3>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-pink-500 rounded-full" />
              <span className="text-xs text-slate-500 font-medium">Revenue</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7Days}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dx={-10} />
                <Tooltip 
                  formatter={(value: number) => [formatMMK(value), 'Sales']}
                  contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  itemStyle={{color: '#db2777', fontWeight: 'bold'}}
                />
                <Area type="monotone" dataKey="sales" stroke="#db2777" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-pink-600" />
              Inventory Value
            </h3>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black text-slate-900">{formatMMK(inventoryValue)}</p>
                <p className="text-sm text-slate-500 font-medium">Current stock valuation</p>
              </div>
              <div className="bg-pink-50 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-pink-600" />
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
                    <span className="text-xs font-black bg-rose-200 text-rose-800 px-2 py-1 rounded-full">{item.total_stock} left</span>
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
        <h3 className="text-lg font-bold text-slate-900 mb-6 font-mono uppercase tracking-tight flex items-center gap-2">
          <Calculator className="w-5 h-5 text-pink-600" />
          Accounting Policies & Logic
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">1</div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">COGS (Cost of Goods Sold)</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Calculated using the <span className="font-bold text-slate-700 italic">Actual Cost at Sale</span> method. 
                  When a sale is recorded, the system captures the current average cost of the product. 
                  Formula: <code className="bg-slate-50 px-1 py-0.5 rounded text-pink-600 font-bold">Σ (Quantity Sold × Unit Cost Snapshot)</code>.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 font-bold shrink-0">2</div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Net Profit Calculation</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Represents the real bottom line after all costs and operating expenses. 
                  Formula: <code className="bg-slate-50 px-1 py-0.5 rounded text-pink-600 font-bold">Revenue - COGS - Total Expenses</code>. 
                  This excludes Inventory Purchases (Repurchases) to reflect operational profit rather than cash flow.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group">
            <TrendingUp className="absolute -right-8 -bottom-8 w-32 h-32 text-white opacity-40 group-hover:scale-110 transition-transform duration-500" />
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Financial Health</h4>
            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Gross Sales</span>
                <span className="font-bold text-slate-900">{formatMMK(totalSales)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">COGS (Direct Costs)</span>
                <span className="font-bold text-rose-500">-{formatMMK(totalCOGS)}</span>
              </div>
              <div className="w-full h-px bg-slate-200 my-1" />
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-900">Gross Profit</span>
                <span className="font-bold text-pink-600">{formatMMK(grossProfit)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Operating Expenses</span>
                <span className="font-bold text-rose-500">-{formatMMK(totalExpenses)}</span>
              </div>
              <div className="w-full h-px bg-slate-400 my-1 opacity-20" />
              <div className="flex justify-between items-center">
                <span className="font-black text-slate-900">Net Profit</span>
                <span className="text-lg font-black text-emerald-600">{formatMMK(netProfit)}</span>
              </div>
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
                  <td className="py-4 font-mono text-xs font-bold text-slate-500">#{sale.order_no}</td>
                  <td className="py-4 text-sm text-slate-600">{format(new Date(sale.date), 'MMM d, yyyy')}</td>
                  <td className="py-4 text-right font-bold text-slate-900">{formatMMK(sale.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
