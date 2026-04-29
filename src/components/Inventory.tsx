import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { Plus, Search, Filter, MoreVertical, Trash2, Edit2, AlertCircle, Calendar, Package, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import { cn, handleFirestoreError, OperationType, formatMMK, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  productCode?: string;
  brand?: string;
  dosage?: string;
  unitCount?: string;
  dosageForm?: string;
  categoryId: string;
  supplierId: string;
  average_cost_price: number;
  current_selling_price: number;
  margin: number;
  total_stock: number;
  expiryDate: string;
  purchaseDate: string;
}

interface ProductDefinition {
  id: string;
  name: string;
  productCode: string;
  brand?: string;
  category?: string;
  dosage?: string;
  unitCount?: string;
  dosageForm?: string;
}

interface Category {
  id: string;
  name: string;
  parent: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface InventoryLog {
  id: string;
  product_id: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  qty: number;
  referenceId?: string;
  reason: string;
  date: any;
  previousQty?: number;
  newQty?: number;
}

import { notifyUndo } from '../lib/notifications';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [view, setView] = useState<'inventory' | 'logs'>('inventory');
  const [masterProducts, setMasterProducts] = useState<ProductDefinition[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; productId: string | null; productName: string }>({
    isOpen: false,
    productId: null,
    productName: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    productCode: '',
    brand: '',
    dosage: '',
    unitCount: '',
    dosageForm: '',
    categoryId: '',
    supplierId: '',
    average_cost_price: 0,
    current_selling_price: 0,
    total_stock: 0,
    expiryDate: '',
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers'));

    const unsubMaster = onSnapshot(collection(db, 'productMaster'), (snapshot) => {
      setMasterProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDefinition)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'productMaster'));

    const unsubLogs = onSnapshot(query(collection(db, 'inventory_logs'), orderBy('date', 'desc'), limit(100)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryLog)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_logs'));

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSuppliers();
      unsubMaster();
      unsubLogs();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: Check for duplicate names
    const isDuplicate = products.some(p => 
      p.name.toLowerCase() === formData.name.toLowerCase() && 
      (!editingProduct || p.id !== editingProduct.id)
    );

    if (isDuplicate) {
      alert('A product with this name already exists. Please use a unique name.');
      return;
    }

    try {
      const margin = formData.current_selling_price - formData.average_cost_price;
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...formData,
          margin,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          margin,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      productCode: product.productCode || '',
      brand: product.brand || '',
      dosage: product.dosage || '',
      unitCount: product.unitCount || '',
      dosageForm: product.dosageForm || '',
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      average_cost_price: product.average_cost_price,
      current_selling_price: product.current_selling_price,
      total_stock: product.total_stock,
      expiryDate: product.expiryDate || '',
      purchaseDate: product.purchaseDate || format(new Date(), 'yyyy-MM-dd'),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      productCode: '',
      brand: '',
      dosage: '',
      unitCount: '',
      dosageForm: '',
      categoryId: '',
      supplierId: '',
      average_cost_price: 0,
      current_selling_price: 0,
      total_stock: 0,
      expiryDate: '',
      purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleDeleteProduct = async (id: string) => {
    const productToDelete = products.find(p => p.id === id);
    if (!productToDelete) return;

    try {
      await deleteDoc(doc(db, 'products', id));
      
      notifyUndo({
        message: `Product "${productToDelete.name}" deleted`,
        undo: async () => {
          const { id: _, ...data } = productToDelete;
          await addDoc(collection(db, 'products'), {
            ...data,
            createdAt: serverTimestamp(),
            isUndone: true
          });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'products');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedProducts, requestSort, sortConfig } = useSortableData(filteredProducts, { key: 'name', direction: 'asc' });

  const exportToExcel = () => {
    const data = sortedProducts.map(p => {
      const category = categories.find(c => c.id === p.categoryId);
      return {
        'Product Code': p.productCode || '',
        'Brand': p.brand || '',
        'Product Name': p.name,
        'Category': category?.name || '',
        'Purchase Price': p.average_cost_price,
        'Sales Price': p.current_selling_price,
        'Stock': p.total_stock,
        'Expiry Date': p.expiryDate,
        'Purchase Date': p.purchaseDate
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `inventory_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-pink-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-pink-600" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight tracking-tight">Stock Management</h2>
          <p className="text-slate-500 font-medium">Monitor levels and track transaction history</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex mr-2">
            <button 
              onClick={() => setView('inventory')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                view === 'inventory' ? "bg-white shadow-sm text-pink-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Inventory
            </button>
            <button 
              onClick={() => setView('logs')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                view === 'logs' ? "bg-white shadow-sm text-pink-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Logs
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-2xl font-bold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      {view === 'inventory' ? (
        <>
          {/* Products Box Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100">
              <div className="flex items-center gap-3 mb-2">
                <Package className="w-5 h-5 text-pink-600" />
                <h3 className="text-xs font-bold text-pink-900 uppercase tracking-wider">Total Products</h3>
              </div>
              <p className="text-2xl font-black text-pink-900">{products.length}</p>
            </div>
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <div className="flex items-center gap-3 mb-2">
                <ArrowUpDown className="w-5 h-5 text-indigo-600" />
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Total Items</h3>
              </div>
              <p className="text-2xl font-black text-indigo-900">{products.reduce((sum, p) => sum + (p.total_stock || 0), 0)}</p>
            </div>
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">In Stock</h3>
              </div>
              <p className="text-2xl font-black text-emerald-900">{products.reduce((sum, p) => sum + (p.total_stock > 0 ? 1 : 0), 0)}</p>
            </div>
            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Out of Stock</h3>
              </div>
              <p className="text-2xl font-black text-rose-900">{products.reduce((sum, p) => sum + (p.total_stock <= 0 ? 1 : 0), 0)}</p>
            </div>
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Expiring</h3>
              </div>
              <p className="text-2xl font-black text-amber-900">
                {products.filter(p => {
                  if (!p.expiryDate || !p.expiryDate.includes('/')) return false;
                  const [month, year] = p.expiryDate.split('/');
                  const expDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                  return expDate.getTime() < new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
                }).length}
              </p>
            </div>
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3 mb-2 text-slate-400">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Stock Value</h3>
              </div>
              <p className="text-lg font-black text-white truncate">
                {formatMMK(products.reduce((sum, p) => sum + (p.total_stock * p.average_cost_price), 0))}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th onClick={() => requestSort('productCode')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                    <div className="flex items-center">Product Code{getSortIcon('productCode')}</div>
                  </th>
                  <th onClick={() => requestSort('brand')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                    <div className="flex items-center">Brand{getSortIcon('brand')}</div>
                  </th>
                  <th onClick={() => requestSort('name')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                    <div className="flex items-center">Product Name{getSortIcon('name')}</div>
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Category</th>
                  <th onClick={() => requestSort('average_cost_price')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                    <div className="flex items-center justify-end">Purchase Price{getSortIcon('average_cost_price')}</div>
                  </th>
                  <th onClick={() => requestSort('current_selling_price')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                    <div className="flex items-center justify-end">Sales Price{getSortIcon('current_selling_price')}</div>
                  </th>
                  <th onClick={() => requestSort('total_stock')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-center cursor-pointer group">
                    <div className="flex items-center justify-center">Stock{getSortIcon('total_stock')}</div>
                  </th>
                  <th onClick={() => requestSort('expiryDate')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-center cursor-pointer group">
                    <div className="flex items-center justify-center">Expiry Date{getSortIcon('expiryDate')}</div>
                  </th>
                  <th onClick={() => requestSort('purchaseDate')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-center cursor-pointer group">
                    <div className="flex items-center justify-center">Purchase Date{getSortIcon('purchaseDate')}</div>
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedProducts.map((product) => {
                  const isLowStock = product.total_stock < 10;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">{product.productCode || '-'}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{product.brand || '-'}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                      <td className="px-6 py-4 text-slate-600 text-xs">
                        {categories.find(c => c.id === product.categoryId)?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatMMK(product.average_cost_price)}</td>
                      <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatMMK(product.current_selling_price)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          product.total_stock < 10 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                        )}>
                          {product.total_stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs">
                        {product.expiryDate ? (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold">
                            {product.expiryDate}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-slate-500">
                        {product.purchaseDate ? format(new Date(product.purchaseDate), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(product);
                            }} 
                            className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ isOpen: true, productId: product.id, productName: product.name });
                            }} 
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xl">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Type</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Qty</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Reason</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {log.date ? format(log.date.toDate(), 'dd/MM/yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{log.productName}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                        log.type === 'IN' ? "bg-emerald-100 text-emerald-700" : 
                        log.type === 'OUT' ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {log.type}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-black",
                      log.type === 'IN' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {log.type === 'OUT' ? `-${log.qty}` : `+${log.qty}`}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{log.reason}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">
                      {log.previousQty} → {log.newQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-pink-600 text-white">
              <h2 className="text-xl font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Select from Product Master</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none bg-pink-50/50"
                    onChange={(e) => {
                      const master = masterProducts.find(m => m.id === e.target.value);
                      if (master) {
                        setFormData({ 
                          ...formData, 
                          name: master.name, 
                          productCode: master.productCode,
                          brand: master.brand || '',
                          dosage: master.dosage || '',
                          unitCount: master.unitCount || '',
                          dosageForm: master.dosageForm || '',
                        });
                      }
                    }}
                    value=""
                  >
                    <option value="">-- Select to auto-fill --</option>
                    {masterProducts.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.productCode})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Product Name</label>
                  <input required type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Product Code / SKU</label>
                  <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.productCode || ''} onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Stock</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.total_stock || 0} onChange={(e) => setFormData({ ...formData, total_stock: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Category</label>
                  <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.categoryId || ''} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
                    <option value="">Select Category</option>
                    {categories.map(c => {
                      const parent = c.parent ? categories.find(p => p.id === c.parent) : null;
                      const label = parent ? `${parent.name} > ${c.name}` : c.name;
                      return <option key={c.id} value={c.id}>{label}</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Supplier</label>
                  <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.supplierId || ''} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}>
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Expiry Date (MM/YYYY)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 12/2025"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                    value={formData.expiryDate} 
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, "");
                      if (val.length > 2) {
                        val = val.slice(0, 2) + "/" + val.slice(2, 6);
                      }
                      setFormData({ ...formData, expiryDate: val });
                    }} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Purchase Price (MMK)</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.average_cost_price || 0} onChange={(e) => setFormData({ ...formData, average_cost_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Sales Price (MMK)</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.current_selling_price || 0} onChange={(e) => setFormData({ ...formData, current_selling_price: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={closeModal} className="px-6 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-8 py-2 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100">
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteConfirm.productName}"? This action cannot be undone.`}
        onConfirm={() => deleteConfirm.productId && handleDeleteProduct(deleteConfirm.productId)}
        onCancel={() => setDeleteConfirm({ isOpen: false, productId: null, productName: '' })}
        confirmText="Delete Product"
      />
    </div>
  );
}
