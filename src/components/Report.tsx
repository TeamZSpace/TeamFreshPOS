import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { 
  TrendingUp, 
  Download, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  ShoppingBag, 
  Receipt, 
  Database, 
  FileSpreadsheet, 
  RefreshCw,
  Layers,
  ArrowRightLeft,
  Package,
  ShoppingCart,
  Hash,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { cn, formatMMK, handleFirestoreError, OperationType, saveToCache, getFromCache } from '../lib/utils';
import { format, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { exportAllToExcel } from '../lib/exportUtils';
import { motion } from 'motion/react';

interface Sale {
  id: string;
  date: string;
  gross_amount?: number;
  tax_amount?: number;
  net_amount?: number;
  total_amount: number;
  subtotal: number;
  items: { product_id: string; name?: string; qty: number; sold_price_snapshot: number; cost_price_snapshot?: number }[];
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
}

interface Product {
  id: string;
  name: string;
  average_cost_price: number;
  current_selling_price: number;
  total_stock: number;
}

interface MasterProduct {
  id: string;
  name: string;
  productCode: string;
}

interface Purchase {
  id: string;
  date: string;
  product_id: string;
  qty: number;
  purchase_price: number;
  total_amount: number;
}

export function Report() {
  const [sales, setSales] = useState<Sale[]>(() => getFromCache<Sale>('sales'));
  const [expenses, setExpenses] = useState<Expense[]>(() => getFromCache<Expense>('expenses'));
  const [products, setProducts] = useState<Product[]>(() => getFromCache<Product>('products'));
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>(() => getFromCache<MasterProduct>('productMaster'));
  const [purchases, setPurchases] = useState<Purchase[]>(() => getFromCache<Purchase>('purchases'));
  
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(() => products.length === 0 || sales.length === 0);
  const [isExportingMaster, setIsExportingMaster] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'profits'>('detailed');
  const [searchProfitQuery, setSearchProfitQuery] = useState('');
  const [profitSortBy, setProfitSortBy] = useState<'profit' | 'qty' | 'rev' | 'name'>('profit');

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          total_amount: Number(d.total_amount || d.totalAmount || 0),
          subtotal: Number(d.subtotal || 0),
          gross_amount: Number(d.gross_amount || d.subtotal || 0),
          order_no: d.order_no || d.orderNumber
        } as any;
      });
      setSales(data);
      saveToCache('sales', data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(data);
      saveToCache('expenses', data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      saveToCache('products', data);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'products');
      setIsLoading(false);
    });

    const unsubMaster = onSnapshot(collection(db, 'productMaster'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterProduct));
      setMasterProducts(data);
      saveToCache('productMaster', data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'productMaster'));

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.date || '',
          product_id: d.product_id || '',
          qty: Number(d.qty || 0),
          purchase_price: Number(d.purchase_price || 0),
          total_amount: Number(d.total_amount || (Number(d.qty || 0) * Number(d.purchase_price || 0)))
        } as Purchase;
      });
      setPurchases(data);
      saveToCache('purchases', data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'purchases'));

    return () => {
      unsubSales();
      unsubExpenses();
      unsubProducts();
      unsubMaster();
      unsubPurchases();
    };
  }, []);

  const months = eachMonthOfInterval({
    start: subMonths(new Date(), 11),
    end: new Date()
  }).reverse();

  // Filters and Period Customizations
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'yearly' | 'all-time'>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const years = React.useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    sales.forEach(s => {
      if (s.date) {
        try {
          yearsSet.add(new Date(s.date).getFullYear());
        } catch (_) {}
      }
    });
    expenses.forEach(e => {
      if (e.date) {
        try {
          yearsSet.add(new Date(e.date).getFullYear());
        } catch (_) {}
      }
    });
    purchases.forEach(p => {
      if (p.date) {
        try {
          yearsSet.add(new Date(p.date).getFullYear());
        } catch (_) {}
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [sales, expenses, purchases]);

  const currentPeriodLabel = React.useMemo(() => {
    if (reportPeriod === 'monthly') {
      return format(selectedMonth, 'MMMM yyyy');
    } else if (reportPeriod === 'yearly') {
      return `Year ${selectedYear}`;
    } else {
      return 'All Time';
    }
  }, [reportPeriod, selectedMonth, selectedYear]);

  const currentMonthSales = React.useMemo(() => {
    return sales.filter(s => {
      if (!s.date) return false;
      try {
        const d = new Date(s.date);
        if (reportPeriod === 'monthly') {
          return isSameMonth(d, selectedMonth);
        } else if (reportPeriod === 'yearly') {
          return d.getFullYear() === selectedYear;
        }
        return true;
      } catch (_) {
        return false;
      }
    });
  }, [sales, reportPeriod, selectedMonth, selectedYear]);

  const currentMonthExpenses = React.useMemo(() => {
    return expenses.filter(e => {
      if (!e.date) return false;
      try {
        const d = new Date(e.date);
        if (reportPeriod === 'monthly') {
          return isSameMonth(d, selectedMonth);
        } else if (reportPeriod === 'yearly') {
          return d.getFullYear() === selectedYear;
        }
        return true;
      } catch (_) {
        return false;
      }
    });
  }, [expenses, reportPeriod, selectedMonth, selectedYear]);

  const currentMonthPurchases = React.useMemo(() => {
    return purchases.filter(p => {
      if (!p.date) return false;
      try {
        const d = new Date(p.date);
        if (reportPeriod === 'monthly') {
          return isSameMonth(d, selectedMonth);
        } else if (reportPeriod === 'yearly') {
          return d.getFullYear() === selectedYear;
        }
        return true;
      } catch (_) {
        return false;
      }
    });
  }, [purchases, reportPeriod, selectedMonth, selectedYear]);

  // Calculations
  const totalRevenue = currentMonthSales.reduce((sum, s) => {
    if (s.gross_amount !== undefined && !isNaN(Number(s.gross_amount))) return sum + Number(s.gross_amount);
    return sum + (s.items || []).reduce((itemSum, item) => itemSum + (Number(item.sold_price_snapshot || 0) * Number(item.qty || 0)), 0);
  }, 0);

  const totalExpenses = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  
  const totalPurchasesAmount = currentMonthPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

  const cogs = currentMonthSales.reduce((sum, sale) => {
    return sum + (sale.items || []).reduce((itemSum, item) => {
      const pid = item.product_id || (item as any).id;
      const product = products.find(p => p.id === pid);
      const costSnapshot = item.cost_price_snapshot !== undefined ? Number(item.cost_price_snapshot) : undefined;
      const productCost = product?.average_cost_price !== undefined ? Number(product.average_cost_price) : 0;
      
      const cost = costSnapshot !== undefined && !isNaN(costSnapshot) ? costSnapshot : productCost;
      const qty = Number(item.qty || 0);
      
      return itemSum + (cost * qty);
    }, 0);
  }, 0);

  const grossProfit = totalRevenue - cogs;
  const netProfit = grossProfit - totalExpenses;
  const profitMarginResult = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const profitMargin = isNaN(profitMarginResult) ? 0 : profitMarginResult;

  // Current Stock Valuation
  const totalInventoryValue = products.reduce((sum, p) => sum + (Number(p.total_stock || 0) * Number(p.average_cost_price || 0)), 0);

  // Aggregated Monthly Sales
  const monthlySoldProducts = React.useMemo(() => {
    const map: { [pid: string]: { name: string; qty: number; totalRev: number; totalCost: number } } = {};
    currentMonthSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const pid = item.product_id || (item as any).id;
        const qty = Number(item.qty || 0);
        const price = Number(item.sold_price_snapshot || 0);
        const costSnapshot = item.cost_price_snapshot !== undefined ? Number(item.cost_price_snapshot) : undefined;
        
        const prod = products.find(p => p.id === pid);
        const cost = costSnapshot !== undefined && !isNaN(costSnapshot) ? costSnapshot : Number(prod?.average_cost_price || 0);
        const pName = prod?.name || item.name || 'Unknown Product';
        
        if (!map[pid]) {
          map[pid] = { name: pName, qty: 0, totalRev: 0, totalCost: 0 };
        }
        map[pid].qty += qty;
        map[pid].totalRev += qty * price;
        map[pid].totalCost += qty * cost;
      });
    });
    return Object.entries(map).map(([id, val]) => {
      const profit = val.totalRev - val.totalCost;
      return {
        id,
        name: val.name,
        qty: val.qty,
        totalRev: val.totalRev,
        totalCost: val.totalCost,
        profit,
        avgPrice: val.qty > 0 ? val.totalRev / val.qty : 0,
        avgCost: val.qty > 0 ? val.totalCost / val.qty : 0
      };
    });
  }, [currentMonthSales, products]);

  // Filtered and Sorted Item-wise Profits for the dedicated view
  const filteredAndSortedProfits = React.useMemo(() => {
    let result = [...monthlySoldProducts];
    
    // 1. Filter by Search Query
    if (searchProfitQuery.trim()) {
      const q = searchProfitQuery.toLowerCase().trim();
      result = result.filter(item => {
        const master = masterProducts.find(m => m.name.toLowerCase() === item.name.toLowerCase());
        const code = master?.productCode?.toLowerCase() || '';
        return item.name.toLowerCase().includes(q) || code.includes(q);
      });
    }

    // 2. Sort
    result.sort((a, b) => {
      if (profitSortBy === 'profit') {
        return b.profit - a.profit; // Highest profit first
      } else if (profitSortBy === 'qty') {
        return b.qty - a.qty; // Highest quantity sold first
      } else if (profitSortBy === 'rev') {
        return b.totalRev - a.totalRev; // Highest revenue first
      } else {
        return a.name.localeCompare(b.name); // Alphabetical A-Z
      }
    });

    return result;
  }, [monthlySoldProducts, searchProfitQuery, profitSortBy, masterProducts]);

  // Aggregated Monthly Purchases
  const monthlyPurchasedProducts = React.useMemo(() => {
    const map: { [pid: string]: { name: string; qty: number; totalCost: number } } = {};
    currentMonthPurchases.forEach(pur => {
      const pid = pur.product_id;
      const qty = Number(pur.qty || 0);
      const price = Number(pur.purchase_price || 0);
      const prod = products.find(p => p.id === pid);
      const pName = prod?.name || 'Unknown Product';
      
      if (!map[pid]) {
        map[pid] = { name: pName, qty: 0, totalCost: 0 };
      }
      map[pid].qty += qty;
      map[pid].totalCost += qty * price;
    });
    return Object.entries(map).map(([id, val]) => ({
      id,
      ...val,
      avgPrice: val.qty > 0 ? val.totalCost / val.qty : 0
    }));
  }, [currentMonthPurchases, products]);

  const monthlyProfitList = React.useMemo(() => {
    return months.map(month => {
      const monthSales = sales.filter(s => isSameMonth(new Date(s.date), month));
      const monthExpenses = expenses.filter(e => isSameMonth(new Date(e.date), month));
      
      const rev = monthSales.reduce((sum, s) => {
        if (s.gross_amount !== undefined && !isNaN(Number(s.gross_amount))) return sum + Number(s.gross_amount);
        return sum + (s.items || []).reduce((itemSum, item) => itemSum + (Number(item.sold_price_snapshot || 0) * Number(item.qty || 0)), 0);
      }, 0);
      const exp = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const cost = monthSales.reduce((sum, sale) => {
        return sum + (sale.items || []).reduce((itemSum, item) => {
          const pid = item.product_id || (item as any).id;
          const product = products.find(p => p.id === pid);
          const costSnapshot = item.cost_price_snapshot !== undefined ? Number(item.cost_price_snapshot) : undefined;
          const productCost = product?.average_cost_price !== undefined ? Number(product.average_cost_price) : 0;
          
          const finalCost = costSnapshot !== undefined && !isNaN(costSnapshot) ? costSnapshot : productCost;
          const qty = Number(item.qty || 0);
          
          return itemSum + (finalCost * qty);
        }, 0);
      }, 0);
      
      const net = rev - cost - exp;
      
      return {
        month,
        revenue: rev,
        expenses: exp,
        cogs: cost,
        netProfit: net
      };
    });
  }, [sales, expenses, products, months]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const periodStr = reportPeriod === 'monthly' 
      ? format(selectedMonth, 'MMMM yyyy') 
      : reportPeriod === 'yearly' 
      ? `Year ${selectedYear}` 
      : 'All Months (All Time)';

    const fileSuffix = reportPeriod === 'monthly' 
      ? format(selectedMonth, 'yyyy_MM') 
      : reportPeriod === 'yearly' 
      ? `year_${selectedYear}` 
      : 'all_months';

    if (activeTab === 'detailed') {
      // 1. Summary Sheet
      const summaryData = [
        [`FreshPOS - Comprehensive Financial & Inventory Report (${periodStr})`, ''],
        ['Period (ကာလ):', periodStr],
        [],
        ['Metric (သတ်မှတ်ချက်)', 'Amount (ပမာဏ - MMK)'],
        ['Total Sales Revenue (စုစုပေါင်း ရောင်းရငွေ)', totalRevenue],
        ['Cost of Goods Sold - COGS (ရောင်းရပစ္စည်း ရင်းနှီးငွေ)', cogs],
        ['Gross Profit (အသားတင်အရောင်းမြတ်)', grossProfit],
        ['Total Operating Expenses (စုစုပေါင်း အသုံးစရိတ်)', totalExpenses],
        ['Net Profit / Loss (အသားတင် အမြတ်/အရှုံး)', netProfit],
        ['Profit Margin (%)', (profitMargin || 0).toFixed(2) + '%'],
        ['Total Purchases This Period (စုစုပေါင်း ဝယ်ယူမှုတန်ဖိုး)', totalPurchasesAmount],
        ['Total Current Inventory Stock Value (လက်ရှိ လက်ကျန်စုစုပေါင်းတန်ဖိုး)', totalInventoryValue]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Financial Metrics');

      // 2. Purchases Sheet
      const purchaseRows = [
        ['Product Code', 'Product Name', 'Quantity Purchased', 'Purchase Price (MMK)', 'Total Cost (MMK)']
      ];
      monthlyPurchasedProducts.forEach(val => {
        const master = masterProducts.find(m => m.name.toLowerCase() === val.name.toLowerCase());
        purchaseRows.push([
          master?.productCode || '-',
          val.name,
          val.qty.toString(),
          val.avgPrice.toFixed(0),
          val.totalCost.toString()
        ]);
      });
      const wsPurchases = XLSX.utils.aoa_to_sheet(purchaseRows);
      XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases');

      // 3. Sales Sheet
      const salesRows = [
        ['Product Code', 'Product Name', 'Quantity Sold', 'Average Sold Price (MMK)', 'Total Sales (MMK)', 'Total Cost (MMK)', 'Total Profit (MMK)', 'Margin (%)']
      ];
      monthlySoldProducts.forEach(val => {
        const master = masterProducts.find(m => m.name.toLowerCase() === val.name.toLowerCase());
        const marginPct = val.totalRev > 0 ? ((val.profit / val.totalRev) * 100).toFixed(1) + '%' : '0%';
        salesRows.push([
          master?.productCode || '-',
          val.name,
          val.qty.toString(),
          val.avgPrice.toFixed(0),
          val.totalRev.toString(),
          val.totalCost.toString(),
          val.profit.toString(),
          marginPct
        ]);
      });
      const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, 'Sales');

      // 4. Expenses Sheet
      const expenseRows = [
        ['Date', 'Category', 'Description', 'Amount (MMK)']
      ];
      currentMonthExpenses.forEach(e => {
        expenseRows.push([
          e.date,
          e.category,
          e.description || '-',
          e.amount.toString()
        ]);
      });
      const wsExpenses = XLSX.utils.aoa_to_sheet(expenseRows);
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Operating Expenses');

      // 5. Inventory Stock Sheet
      const inventoryRows = [
        ['Product Code', 'Product Name', 'Current Stock Qty', 'Average Purchase Price (MMK)', 'Total Asset value (MMK)']
      ];
      products.forEach(p => {
        const master = masterProducts.find(m => m.name.toLowerCase() === p.name.toLowerCase());
        const stock = p.total_stock || 0;
        const avgPrice = p.average_cost_price || 0;
        inventoryRows.push([
          master?.productCode || '-',
          p.name,
          stock.toString(),
          avgPrice.toString(),
          (stock * avgPrice).toString()
        ]);
      });
      const wsInventory = XLSX.utils.aoa_to_sheet(inventoryRows);
      XLSX.utils.book_append_sheet(wb, wsInventory, 'Current Inventory');

    } else {
      // Classic summary report
      const reportData = [
        ['Financial Report', periodStr],
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
        ...currentMonthSales.map(s => {
          let dateStr = '';
          try {
            dateStr = format(new Date(s.date), 'yyyy-MM-dd');
          } catch (_) {
            dateStr = s.date;
          }
          return [dateStr, s.id, s.total_amount];
        }),
        [],
        ['Expense Details'],
        ['Date', 'Category', 'Amount'],
        ...currentMonthExpenses.map(e => {
          let dateStr = '';
          try {
            dateStr = format(new Date(e.date), 'yyyy-MM-dd');
          } catch (_) {
            dateStr = e.date;
          }
          return [dateStr, e.category, e.amount];
        })
      ];
      const ws = XLSX.utils.aoa_to_sheet(reportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Report Overview');
    }

    XLSX.writeFile(wb, `FreshPOS_Report_${fileSuffix}.xlsx`);
  };

  const handleMasterExport = async () => {
    setIsExportingMaster(true);
    try {
      await exportAllToExcel(db);
    } catch (err) {
      alert('Failed to export master data. See console for details.');
    } finally {
      setIsExportingMaster(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-10 h-10 text-pink-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold">ဆေးဆိုင် လုပ်ငန်းသုံး စာရင်းဇယားအစီရင်ခံစာများကို ဖွင့်နေပါသည်...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section with selector and Export */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-pink-100 rounded-xl">
            <Layers className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Performance Report ({reportPeriod === 'monthly' ? 'လစဉ်' : reportPeriod === 'yearly' ? `${selectedYear} နှစ်စဉ်` : 'လအားလုံး/စုစုပေါင်း'} အစီရင်ခံစာဇယား)
            </h2>
            <p className="text-sm text-slate-500">Business overview, Sales, Purchasing & Inventory analysis</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Tabs Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-xs border border-slate-200/50">
            <button
              onClick={() => setReportPeriod('monthly')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all whitespace-nowrap",
                reportPeriod === 'monthly' ? "bg-white text-pink-600 shadow-xs" : "text-slate-600 hover:text-slate-800"
              )}
            >
              လစဉ် (Monthly)
            </button>
            <button
              onClick={() => setReportPeriod('yearly')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all whitespace-nowrap",
                reportPeriod === 'yearly' ? "bg-white text-pink-600 shadow-xs" : "text-slate-600 hover:text-slate-800"
              )}
            >
              နှစ်စဉ် (Yearly)
            </button>
            <button
              onClick={() => setReportPeriod('all-time')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all whitespace-nowrap",
                reportPeriod === 'all-time' ? "bg-white text-pink-600 shadow-xs" : "text-slate-600 hover:text-slate-800"
              )}
            >
              စုစုပေါင်း (All Time)
            </button>
          </div>

          {/* Conditional Dropdowns */}
          {reportPeriod === 'monthly' && (
            <select 
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none shadow-sm font-semibold text-slate-800 text-xs sm:text-sm"
              value={selectedMonth.toISOString()}
              onChange={(e) => setSelectedMonth(new Date(e.target.value))}
            >
              {months.map(m => (
                <option key={m.toISOString()} value={m.toISOString()}>
                  {format(m, 'MMMM yyyy')}
                </option>
              ))}
            </select>
          )}

          {reportPeriod === 'yearly' && (
            <select 
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none shadow-sm font-semibold text-slate-800 text-xs sm:text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {years.map(y => (
                <option key={y} value={y}>
                  နှစ် {y}
                </option>
              ))}
            </select>
          )}
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-pink-100 cursor-pointer"
          >
            <Download className="w-5 h-5 animate-pulse" />
            <span>Generate Excel</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Selector */}
      <div className="flex flex-col sm:flex-row border border-slate-200 bg-white p-1 rounded-2xl shadow-sm gap-1 sm:gap-0">
        <button
          onClick={() => setActiveTab('detailed')}
          className={cn(
            "flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'detailed' 
              ? "bg-pink-50 text-pink-700 shadow-inner" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Detailed Report (လစဉ်အသေးစိတ်)</span>
        </button>
        <button
          onClick={() => setActiveTab('profits')}
          className={cn(
            "flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border-y sm:border-y-0 sm:border-x border-slate-100",
            activeTab === 'profits' 
              ? "bg-pink-50 text-pink-700 shadow-inner" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <DollarSign className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span>Item-wise Profits (တစ်ဘူးချင်းစီ အမြတ်စာရင်း)</span>
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'overview' 
              ? "bg-pink-50 text-pink-700 shadow-inner" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <TrendingUp className="w-4 h-4 text-pink-600" />
          <span>Performance & Margins (ခြုံငုံသုံးသပ်ချက်)</span>
        </button>
      </div>

      {/* Render detailed tab or overview tab */}
      {activeTab === 'detailed' ? (
        <div className="space-y-8 animate-fadeIn">
          {/* Detailed Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Sales</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">Total Sales (ရောင်းရငွေ)</p>
              </div>
              <p className="text-lg font-black text-slate-800 mt-2">{formatMMK(totalRevenue)}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Database className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">COGS</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">COGS (ရင်းနှီးငွေ)</p>
              </div>
              <p className="text-lg font-black text-rose-600 mt-2">-{formatMMK(cogs)}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <ShoppingCart className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Purchases</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">Total Purchases (စုစုပေါင်းဝယ်ယူမှု)</p>
              </div>
              <p className="text-lg font-black text-slate-800 mt-2">{formatMMK(totalPurchasesAmount)}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-rose-50 rounded-lg">
                    <Receipt className="w-4 h-4 text-rose-600" />
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">Expenses</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">Expenses (စုစုပေါင်းအသုံးစရိတ်)</p>
              </div>
              <p className="text-lg font-black text-rose-600 mt-2">-{formatMMK(totalExpenses)}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Profit</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">Net Profit (အသားတင်အမြတ်)</p>
              </div>
              <p className={cn(
                "text-lg font-black mt-2",
                netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatMMK(netProfit)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-teal-50 rounded-lg">
                    <Package className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">Inventory</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">Inventory Value (စုစုပေါင်းကုန်လက်ကျန်)</p>
              </div>
              <p className="text-lg font-black text-slate-800 mt-2">{formatMMK(totalInventoryValue)}</p>
            </div>
          </div>

          {/* 3 Col Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Purchases */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[480px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4.5 h-4.5 text-pink-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    {reportPeriod === 'monthly' ? 'Purchases this Month' : reportPeriod === 'yearly' ? 'Purchases this Year' : 'All-time Purchases'} (ပစ္စည်းဝယ်ယူမှုများ)
                  </h3>
                </div>
                <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-bold">
                  {monthlyPurchasedProducts.length} Items
                </span>
              </div>
              <div className="overflow-y-auto flex-1 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-xs z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-500">Product Name</th>
                      <th className="px-3 py-3 font-semibold text-slate-500 text-center">Qty</th>
                      <th className="px-3 py-3 font-semibold text-slate-500 text-right">Cost Price</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyPurchasedProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-800 break-words whitespace-normal text-[11px]" title={p.name}>{p.name}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">{p.qty}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500">{formatMMK(p.avgPrice)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-800">{formatMMK(p.totalCost)}</td>
                      </tr>
                    ))}
                    {monthlyPurchasedProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">
                          ဤလအတွင်း ဝယ်ယူမှုမှတ်တမ်း မရှိပါ။
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center font-black text-slate-900 text-xs">
                <span>Total Purchases:</span>
                <span className="text-pink-600">{formatMMK(totalPurchasesAmount)}</span>
              </div>
            </div>

            {/* Column 2: Sales */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[480px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4.5 h-4.5 text-rose-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    {reportPeriod === 'monthly' ? 'Sales this Month' : reportPeriod === 'yearly' ? 'Sales this Year' : 'All-time Sales'} (အရောင်းစာရင်း)
                  </h3>
                </div>
                <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                  {monthlySoldProducts.length} Items
                </span>
              </div>
              <div className="overflow-y-auto flex-1 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-xs z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-500">Product Name</th>
                      <th className="px-3 py-3 font-semibold text-slate-500 text-center">Qty</th>
                      <th className="px-3 py-3 font-semibold text-slate-500 text-right">Avg Retail</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlySoldProducts.map((p, idx) => {
                      const itemProfit = p.profit;
                      const itemPercent = p.totalRev > 0 ? (itemProfit / p.totalRev) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 flex flex-col justify-center min-h-[50px]">
                            <span className="font-bold text-slate-800 break-words whitespace-normal text-[11px] leading-tight" title={p.name}>
                              {p.name}
                            </span>
                            <span className={cn(
                              "text-[10px] font-extrabold mt-0.5",
                              itemProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              အမြတ်: {itemProfit >= 0 ? '+' : ''}{formatMMK(itemProfit)} ({itemPercent.toFixed(0)}%)
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-slate-700">{p.qty}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatMMK(p.avgPrice)}</td>
                          <td className="px-4 py-2 text-right font-black text-slate-800">{formatMMK(p.totalRev)}</td>
                        </tr>
                      );
                    })}
                    {monthlySoldProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">
                          ဤလအတွင်း ရောင်းရမှုမှတ်တမ်း မရှိပါ။
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center font-black text-slate-900 text-xs">
                <span>Total Revenue:</span>
                <span className="text-rose-600">{formatMMK(totalRevenue)}</span>
              </div>
            </div>

            {/* Column 3: Expenses */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[480px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4.5 h-4.5 text-purple-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    {reportPeriod === 'monthly' ? 'Expenses breakdown' : reportPeriod === 'yearly' ? 'Expenses breakdown' : 'All-time Expenses'} (အသုံးစရိတ်)
                  </h3>
                </div>
                <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">
                  {currentMonthExpenses.length} Notes
                </span>
              </div>
              <div className="overflow-y-auto flex-1 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-xs z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-500">Category / Desc</th>
                      <th className="px-3 py-3 font-semibold text-slate-500 text-center">Date</th>
                      <th className="px-4 py-3 font-semibold text-slate-500 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentMonthExpenses.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5">
                          <span className="font-bold text-slate-800 text-[11px] block">{e.category}</span>
                          <span className="text-slate-400 text-[10px] block break-words whitespace-normal">{e.description || '-'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-500 whitespace-nowrap">{e.date}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-rose-500">{formatMMK(e.amount)}</td>
                      </tr>
                    ))}
                    {currentMonthExpenses.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-12 text-center text-slate-400 italic">
                          ဤလအတွင်း အသုံးစရိတ် မရှိပါ။
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center font-black text-slate-900 text-xs">
                <span>Total Operating Expense:</span>
                <span className="text-rose-600">{formatMMK(totalExpenses)}</span>
              </div>
            </div>

          </div>

          {/* Large Card: Current Inventory Valuation list */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-md">
                  <Package className="w-5 h-5 text-teal-600" />
                  Current Stock Valuation Ledger (လက်ကျန်ကုန်ပစ္စည်း တန်ဖိုးသတ်မှတ်ချက်စာရင်း)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time stock quantities and calculated asset capital values</p>
              </div>
              
              <div className="bg-teal-50 px-4 py-2 border border-teal-100 rounded-xl flex items-center gap-2 self-start sm:self-center">
                <Database className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold text-teal-900 uppercase">Total Asset Value:</span>
                <span className="text-sm font-black text-teal-600">{formatMMK(totalInventoryValue)}</span>
              </div>
            </div>
            
            <div className="overflow-x-auto text-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 font-semibold text-slate-600">Product Code</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">Product Name</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-center">Current Stock Qty (လက်ကျန်စုစုပေါင်း)</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-right">Average cost Price (ဝယ်ယူအဝယ်ပျှမ်းမျှဈေး)</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-right">Valuation Asset cost (လက်ကျန်စုစုပေါင်းတန်ဖိုး / Cap)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => {
                    const master = masterProducts.find(m => m.name.toLowerCase() === p.name.toLowerCase());
                    const stock = p.total_stock || 0;
                    const avgPrice = p.average_cost_price || 0;
                    const stockVal = stock * avgPrice;
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-xs font-bold text-slate-400">{master?.productCode || '-'}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-800">{p.name}</td>
                        <td className="px-6 py-3.5 text-center font-black">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-black",
                            stock > 5 ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"
                          )}>
                            {stock}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium text-slate-500">{formatMMK(avgPrice)}</td>
                        <td className="px-6 py-3.5 text-right font-black text-slate-800">{formatMMK(stockVal)}</td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        လက်ကျန်ပစ္စည်းစာရင်း မရှိသေးပါ။
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Total Capital Inventory Assessment:</span>
              <span className="text-teal-600 text-lg">{formatMMK(totalInventoryValue)}</span>
            </div>
          </div>
        </div>
      ) : activeTab === 'profits' ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">Total Sales Profit (ရောင်းရငွေမှ စုစုပေါင်းအမြတ်)</p>
                <p className="text-lg font-black text-emerald-600 mt-0.5">
                  {formatMMK(filteredAndSortedProfits.reduce((sum, p) => sum + p.profit, 0))}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">Total Items Sold (ရောင်းချရသည့် စုစုပေါင်းအရေအတွက်)</p>
                <p className="text-lg font-black text-blue-600 mt-0.5">
                  {filteredAndSortedProfits.reduce((sum, p) => sum + p.qty, 0)} ဘူး
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">Average Margin % (ပျှမ်းမျှ အမြတ်ရာခိုင်နှုန်း)</p>
                <p className="text-lg font-black text-purple-600 mt-0.5">
                  {(() => {
                    const totalRev = filteredAndSortedProfits.reduce((sum, p) => sum + p.totalRev, 0);
                    const totalProfit = filteredAndSortedProfits.reduce((sum, p) => sum + p.profit, 0);
                    return totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) + '%' : '0%';
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* Filtering and Sorting Row */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchProfitQuery}
                onChange={(e) => setSearchProfitQuery(e.target.value)}
                placeholder="Product Name သို့မဟုတ် Code ဖြင့် ရှာဖွေပါ..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-pink-500 bg-slate-50/50"
              />
              {searchProfitQuery && (
                <button 
                  onClick={() => setSearchProfitQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" /> Filter/Sort:
              </span>
              <select
                value={profitSortBy}
                onChange={(e) => setProfitSortBy(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 cursor-pointer"
              >
                <option value="profit">Highest Profit (အမြတ်အများဆုံး)</option>
                <option value="qty">Units Sold (အရောင်းရဆုံး)</option>
                <option value="rev">Total Revenue (ရောင်းရငွေ အများဆုံး)</option>
                <option value="name">Name A-Z (အက္ခရာအစဉ်အတိုင်း)</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs">
                Item-wise profit ledger ({currentPeriodLabel})
              </h3>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-black">
                {filteredAndSortedProfits.length} items sold
              </span>
            </div>

            <div className="overflow-x-auto text-xs sm:text-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 font-semibold text-slate-600">Product Code/Name</th>
                    <th className="px-4 py-4 font-semibold text-slate-600 text-center">Units Sold</th>
                    <th className="px-4 py-4 font-semibold text-slate-600 text-right">Selling Price (Avg)</th>
                    <th className="px-4 py-4 font-semibold text-slate-600 text-right">Cost Price (Avg)</th>
                    <th className="px-4 py-4 font-semibold text-slate-600 text-right">Total Revenue</th>
                    <th className="px-4 py-4 font-semibold text-slate-600 text-right">Total Cost</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-right">Total Net Profit</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-center">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedProfits.map((p, idx) => {
                    const master = masterProducts.find(m => m.name.toLowerCase() === p.name.toLowerCase());
                    const marginPercent = p.totalRev > 0 ? (p.profit / p.totalRev) * 100 : 0;
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="font-mono text-[10px] text-slate-400 font-bold block">{master?.productCode || '-'}</span>
                          <span className="font-black text-slate-800 text-[11px] block mt-0.5 p-0" title={p.name}>{p.name}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-700 text-[11px]">
                          {p.qty}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-500 whitespace-nowrap">
                          {formatMMK(p.avgPrice)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-500 whitespace-nowrap">
                          {formatMMK(p.avgCost)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-slate-800 whitespace-nowrap">
                          {formatMMK(p.totalRev)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-500 whitespace-nowrap">
                          {formatMMK(p.totalCost)}
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                          <span className={cn(
                            "font-black text-[12px]",
                            p.profit >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {p.profit >= 0 ? '+' : ''}{formatMMK(p.profit)}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-center whitespace-nowrap">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black",
                            p.profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          )}>
                            {marginPercent.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAndSortedProfits.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-slate-400 italic">
                        ရောင်းချရသည့် ပစ္စည်းမှတ်တမ်း မရှိပါ။
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Footer row */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center text-xs font-black text-slate-900 gap-4">
              <span className="text-[11px] text-slate-400 font-normal">
                * အထက်ပါ ဇယားသည် ရွေးချယ်ထားသော ကာလအပိုင်းအခြားအတွင်း ရောင်းချခဲ့ရသည့် ပစ္စည်းတစ်ခုချင်းစီ၏ ရင်းနှီးငွေနှင့် အမြတ်ငွေစာရင်း ဖြစ်သည်။
              </span>
              <div className="flex items-center gap-2 self-end">
                <span>စုစုပေါင်းအသားတင်အမြတ်:</span>
                <span className="text-emerald-600 text-sm font-black">
                  {formatMMK(filteredAndSortedProfits.reduce((sum, p) => sum + p.profit, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Overview tab - Original view structure */
        <div className="space-y-8 animate-fadeIn">
          {/* Overview summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">Revenue</span>
              </div>
              <p className="text-sm text-slate-500 mb-1">Total Sales</p>
              <p className="text-xl font-black text-slate-900">{formatMMK(totalRevenue)}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Database className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-md">Cost</span>
              </div>
              <p className="text-sm text-slate-500 mb-1">Total COGS</p>
              <p className="text-xl font-black text-slate-900">{formatMMK(cogs)}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-rose-50 rounded-lg">
                  <Receipt className="w-5 h-5 text-rose-600" />
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">Expenses</span>
              </div>
              <p className="text-sm text-slate-500 mb-1">Operating Costs</p>
              <p className="text-xl font-black text-slate-900">{formatMMK(totalExpenses)}</p>
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
                "text-xl font-black",
                netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatMMK(netProfit)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm md:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Margin</span>
              </div>
              <p className="text-sm text-slate-500 mb-1">Profitability</p>
              <p className="text-xl font-black text-slate-900">{profitMargin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Monthly Net Profit Check List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pink-600" />
                <h3 className="font-bold text-slate-900">Monthly Net Profit Checklist</h3>
              </div>
              <span className="text-xs text-slate-500 italic">Historical performance for the last 12 months</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Month</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Revenue</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">COGS</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Expenses</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyProfitList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">{format(item.month, 'MMMM yyyy')}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatMMK(item.revenue)}</td>
                      <td className="px-6 py-4 text-right text-rose-500">-{formatMMK(item.cogs)}</td>
                      <td className="px-6 py-4 text-right text-rose-500">-{formatMMK(item.expenses)}</td>
                      <td className="px-6 py-4 text-right font-black">
                        <span className={cn(
                          "flex items-center justify-end gap-1",
                          item.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {item.netProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {formatMMK(item.netProfit)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  {netProfit >= 0 
                    ? `${reportPeriod === 'monthly' ? 'Profitable Month!' : reportPeriod === 'yearly' ? 'Profitable Year!' : 'Profitable All-Time!'}` 
                    : `${reportPeriod === 'monthly' ? 'Loss this Month' : reportPeriod === 'yearly' ? 'Loss this Year' : 'Net Loss All-Time'}`}
                </h4>
                <p className="text-sm text-slate-500 max-w-[250px]">
                  {netProfit >= 0 
                    ? `You've made a net profit of ${formatMMK(netProfit)} during this period. Keep up the good work!`
                    : `You've incurred a loss of ${formatMMK(Math.abs(netProfit))} during this period. Review your expenses.`}
                </p>
              </div>
            </div>
          </div>

          {/* Product Sales Performance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Product Sales Performance Balance</h3>
              <span className="text-xs text-slate-500 italic">Actual sales and profits for {currentPeriodLabel}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Code</th>
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
                      const item = (sale.items || []).find(i => (i.product_id || (i as any).id) === product.id);
                      if (item) {
                        const qty = Number(item.qty || 0);
                        acc.units += qty;
                        acc.revenue += qty * Number(item.sold_price_snapshot || 0);
                        const costSnapshot = item.cost_price_snapshot !== undefined ? Number(item.cost_price_snapshot) : undefined;
                        const cost = costSnapshot !== undefined && !isNaN(costSnapshot) ? costSnapshot : Number(product.average_cost_price || 0);
                        acc.cost += qty * cost;
                      }
                      return acc;
                    }, { units: 0, revenue: 0, cost: 0 });

                    if (productSales.units === 0) return null;

                    const profit = productSales.revenue - productSales.cost;
                    const master = masterProducts.find(m => m.name.toLowerCase() === product.name.toLowerCase());

                    return (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{master?.productCode || '-'}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                        <td className="px-6 py-4 text-center text-slate-600 font-bold">{productSales.units}</td>
                        <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatMMK(productSales.revenue)}</td>
                        <td className="px-6 py-4 text-right text-rose-600">{formatMMK(productSales.cost)}</td>
                        <td className="px-6 py-4 text-right text-emerald-600 font-black">{formatMMK(profit)}</td>
                      </tr>
                    );
                  }).filter(Boolean)}
                  {products.every(p => !currentMonthSales.some(s => s.items.some(i => i.product_id === p.id))) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                        No product sales recorded for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Product Margin Analysis Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Product Margin Analysis</h3>
              <span className="text-xs text-slate-500 italic">Margin column overview</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Code</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Purchase Price</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Selling Price</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Margin (%)</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Profit/Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(product => {
                    const margin = (product.current_selling_price || 0) - (product.average_cost_price || 0);
                    const avgCost = product.average_cost_price || 0;
                    const marginPercentResult = avgCost > 0 ? (margin / avgCost) * 100 : 0;
                    const marginPercent = isNaN(marginPercentResult) ? 0 : marginPercentResult;
                    const master = masterProducts.find(m => m.name.toLowerCase() === product.name.toLowerCase());
                    return (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{master?.productCode || '-'}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{formatMMK(product.average_cost_price)}</td>
                        <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatMMK(product.current_selling_price)}</td>
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
      )}

      {/* Footer / All Data Master Export */}
      <div className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-3xl p-8 text-white shadow-xl shadow-pink-100 flex flex-col md:flex-row items-center justify-between gap-6 mt-8">
        <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
            <Database className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Master Data Export</h3>
            <p className="text-pink-50 text-sm opacity-90 mt-1">Download all collections (Products, Sales, CRM, etc.) into a single multi-sheet Excel file.</p>
          </div>
        </div>
        <button
          onClick={handleMasterExport}
          disabled={isExportingMaster}
          className="flex items-center gap-3 px-8 py-4 bg-white text-pink-600 rounded-2xl font-bold hover:bg-pink-50 transition-all shadow-lg min-w-[200px] justify-center disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
        >
          {isExportingMaster ? <RefreshCw className="w-6 h-6 animate-spin" /> : <FileSpreadsheet className="w-6 h-6 group-hover:scale-110 transition-transform" />}
          <span>{isExportingMaster ? 'Generating...' : 'Export All Menus'}</span>
        </button>
      </div>
    </div>
  );
}
