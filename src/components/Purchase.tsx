import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, runTransaction, deleteDoc } from 'firebase/firestore';
import { Plus, ShoppingCart, Calendar, Truck, DollarSign, Package, Edit2, Trash2, AlertTriangle, Search, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import { handleFirestoreError, OperationType, formatMMK, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';
import * as XLSX from 'xlsx';

interface Purchase {
  id: string;
  date: string;
  product_id: string;
  supplierId: string;
  categoryId: string;
  qty: number;
  purchase_price: number;
  current_selling_price: number;
  shipping: number;
  total_amount: number;
  expiryDate?: string;
}

interface Product {
  id: string;
  name: string;
  productCode?: string;
  brand?: string;
  dosage?: string;
  unitCount?: string;
  dosageForm?: string;
  total_stock: number;
  average_cost_price: number;
  current_selling_price: number;
  categoryId: string;
  supplierId?: string;
  expiryDate?: string;
  purchaseDate?: string;
}

interface MasterProduct {
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

import { notifyUndo } from '../lib/notifications';

export function Purchase() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; purchase: Purchase | null }>({
    isOpen: false,
    purchase: null
  });
  const [formData, setFormData] = useState({
    product_id: '',
    supplierId: '',
    categoryId: '',
    qty: 0,
    purchase_price: 0,
    current_selling_price: 0,
    shipping: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    expiryDate: '',
    productCode: '',
  });
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'purchases'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers'));

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    const unsubMaster = onSnapshot(collection(db, 'productMaster'), (snapshot) => {
      setMasterProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterProduct)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'productMaster'));

    return () => {
      unsubPurchases();
      unsubProducts();
      unsubSuppliers();
      unsubCategories();
      unsubMaster();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newPurchaseTotal = (formData.qty * formData.purchase_price) + formData.shipping;

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', formData.product_id);
        const productDoc = await transaction.get(productRef);
        const masterProduct = masterProducts.find(p => p.id === formData.product_id);
        
        if (!productDoc.exists() && !masterProduct) {
          throw new Error("Product not found in Master or Inventory");
        }
        
        const currentData = productDoc.exists() 
          ? productDoc.data() as Product 
          : {
              id: masterProduct!.id,
              name: masterProduct!.name,
              productCode: masterProduct!.productCode,
              brand: masterProduct!.brand || '',
              dosage: masterProduct!.dosage || '',
              unitCount: masterProduct!.unitCount || '',
              dosageForm: masterProduct!.dosageForm || '',
              total_stock: 0,
              average_cost_price: 0,
              categoryId: formData.categoryId,
            } as Product;
        
        const existingQty = currentData.total_stock || 0;
        const existingCost = currentData.average_cost_price || 0;
        let weightedLandedCost = existingCost;

        if (editingPurchase) {
          const oldQty = editingPurchase.qty;
          const oldTotal = editingPurchase.total_amount;
          
          // Revert old purchase first to get pre-purchase state
          const revertedQty = existingQty - oldQty;
          const revertedValue = (existingQty * existingCost) - oldTotal;
          
          // Apply new purchase to reverted state
          const finalQty = revertedQty + formData.qty;
          const finalValue = revertedValue + newPurchaseTotal;
          
          weightedLandedCost = finalQty > 0 ? finalValue / finalQty : (formData.qty > 0 ? newPurchaseTotal / formData.qty : existingCost);

          // Handle if product changed (rare but possible)
          if (editingPurchase.product_id !== formData.product_id) {
            const oldProductRef = doc(db, 'products', editingPurchase.product_id);
            const oldProductDoc = await transaction.get(oldProductRef);
            if (oldProductDoc.exists()) {
              const oldProd = oldProductDoc.data() as Product;
              const adjQty = oldProd.total_stock - oldQty;
              const adjValue = (oldProd.total_stock * oldProd.average_cost_price) - oldTotal;
              transaction.update(oldProductRef, {
                total_stock: adjQty,
                average_cost_price: adjQty > 0 ? adjValue / adjQty : oldProd.average_cost_price
              });
            }
            // For the new product, it's like a fresh purchase added to existing
            const totalQtyNew = existingQty + formData.qty;
            const totalValueNew = (existingQty * existingCost) + newPurchaseTotal;
            weightedLandedCost = totalQtyNew > 0 ? totalValueNew / totalQtyNew : (formData.qty > 0 ? newPurchaseTotal / formData.qty : existingCost);
          }

          transaction.set(productRef, {
            ...currentData,
            total_stock: editingPurchase.product_id === formData.product_id ? (existingQty - oldQty + formData.qty) : (existingQty + formData.qty),
            average_cost_price: weightedLandedCost,
            current_selling_price: formData.current_selling_price,
            categoryId: formData.categoryId,
            supplierId: formData.supplierId,
            expiryDate: formData.expiryDate,
            purchaseDate: formData.date
          }, { merge: true });

          transaction.update(doc(db, 'purchases', editingPurchase.id), {
            ...formData,
            total_amount: newPurchaseTotal,
            updatedAt: serverTimestamp(),
          });

          // Record Inventory Log
          const logRef = doc(collection(db, 'inventory_logs'));
          transaction.set(logRef, {
            product_id: formData.product_id,
            productName: currentData.name,
            type: 'ADJUST',
            qty: formData.qty - oldQty,
            referenceId: editingPurchase.id,
            reason: 'Purchase Updated',
            date: serverTimestamp(),
            previousQty: existingQty,
            newQty: editingPurchase.product_id === formData.product_id ? (existingQty - oldQty + formData.qty) : (existingQty + formData.qty)
          });
        } else {
          const totalQty = existingQty + formData.qty;
          const totalValue = (existingQty * existingCost) + newPurchaseTotal;
          weightedLandedCost = totalQty > 0 ? totalValue / totalQty : (formData.qty > 0 ? newPurchaseTotal / formData.qty : existingCost);

          transaction.set(productRef, {
            ...currentData,
            total_stock: totalQty,
            average_cost_price: weightedLandedCost,
            current_selling_price: formData.current_selling_price,
            categoryId: formData.categoryId,
            supplierId: formData.supplierId,
            expiryDate: formData.expiryDate,
            purchaseDate: formData.date
          }, { merge: true });

          const purchaseRef = doc(collection(db, 'purchases'));
          const purchaseId = purchaseRef.id;
          transaction.set(purchaseRef, {
            ...formData,
            total_amount: newPurchaseTotal,
            createdAt: serverTimestamp(),
          });

          // Record Inventory Log
          const logRef = doc(collection(db, 'inventory_logs'));
          transaction.set(logRef, {
            product_id: formData.product_id,
            productName: currentData.name,
            type: 'IN',
            qty: formData.qty,
            referenceId: purchaseId,
            reason: 'New Purchase',
            date: serverTimestamp(),
            previousQty: existingQty,
            newQty: totalQty
          });
        }
      });

      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingPurchase ? OperationType.UPDATE : OperationType.CREATE, 'purchases');
    }
  };

  const openEditModal = (p: Purchase) => {
    setEditingPurchase(p);
    setFormData({
      product_id: p.product_id,
      supplierId: p.supplierId,
      categoryId: p.categoryId,
      qty: p.qty,
      purchase_price: p.purchase_price,
      current_selling_price: p.current_selling_price,
      shipping: p.shipping,
      date: p.date.split('T')[0],
      expiryDate: p.expiryDate || '',
      productCode: products.find(prod => prod.id === p.product_id)?.productCode || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
    setFormData({ 
      product_id: '', 
      supplierId: '', 
      categoryId: '',
      qty: 0, 
      purchase_price: 0, 
      current_selling_price: 0,
      shipping: 0, 
      date: format(new Date(), 'yyyy-MM-dd'),
      expiryDate: '',
      productCode: '',
    });
  };

  const handleDelete = async (purchase: Purchase) => {
    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const productRef = doc(db, 'products', purchase.product_id);
        const productDoc = await transaction.get(productRef);
        
        // 2. WRITES SECOND
        if (productDoc.exists()) {
          const product = productDoc.data() as Product;
          const currentQty = product.total_stock || 0;
          const currentCost = product.average_cost_price || 0;
          const purchaseQty = purchase.qty;
          const purchaseTotal = purchase.total_amount;

          const newQty = currentQty - purchaseQty;
          const newValue = (currentQty * currentCost) - purchaseTotal;
          
          transaction.update(productRef, {
            total_stock: newQty,
            average_cost_price: newQty > 0 ? newValue / newQty : currentCost
          });
        }
        transaction.delete(doc(db, 'purchases', purchase.id));

        // Record Inventory Log
        const logRef = doc(collection(db, 'inventory_logs'));
        transaction.set(logRef, {
          product_id: purchase.product_id,
          productName: products.find(p => p.id === purchase.product_id)?.name || 'Unknown',
          type: 'OUT',
          qty: purchase.qty,
          referenceId: purchase.id,
          reason: 'Purchase Deleted',
          date: serverTimestamp(),
        });
      });

      const productName = products.find(p => p.id === purchase.product_id)?.name || 'Product';
      notifyUndo({
        message: `Purchase of ${productName} deleted`,
        undo: async () => {
          await runTransaction(db, async (transaction) => {
            // 1. READS FIRST
            const productRef = doc(db, 'products', purchase.product_id);
            const productDoc = await transaction.get(productRef);
            
            // 2. WRITES SECOND
            if (productDoc.exists()) {
              const product = productDoc.data() as Product;
              const currentQty = product.total_stock || 0;
              const currentCost = product.average_cost_price || 0;
              const purchaseQty = purchase.qty;
              const purchaseTotal = purchase.total_amount;

              const newQty = currentQty + purchaseQty;
              const newValue = (currentQty * currentCost) + purchaseTotal;

              transaction.update(productRef, {
                total_stock: newQty,
                average_cost_price: newQty > 0 ? newValue / newQty : currentCost
              });
            }
            const { id, ...data } = purchase;
            transaction.set(doc(db, 'purchases', id), {
              ...data,
              createdAt: serverTimestamp(),
              isUndone: true
            });
          });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'purchases');
    }
  };

  const { items: sortedPurchases, requestSort, sortConfig } = useSortableData(purchases, { key: 'date', direction: 'desc' });

  const exportToExcel = () => {
    const data = sortedPurchases.map(p => {
      const product = products.find(prod => prod.id === p.product_id);
      const supplier = suppliers.find(s => s.id === p.supplierId);
      return {
        'Date': p.date,
        'Product': product?.name || '',
        'Supplier': supplier?.name || '',
        'Quantity': p.qty,
        'Unit Cost': p.purchase_price,
        'Shipping': p.shipping,
        'Total Amount': p.total_amount
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
    XLSX.writeFile(wb, `purchases_export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-pink-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-pink-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center transition-all animate-in slide-in-from-top duration-500">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-pink-600" />
          Purchase History
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 group"
          >
            <FileSpreadsheet className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100"
          >
            <Plus className="w-5 h-5" />
            New Purchase
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th onClick={() => requestSort('date')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Date{getSortIcon('date')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Code</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Category</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Supplier</th>
              <th onClick={() => requestSort('qty')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-center cursor-pointer group">
                <div className="flex items-center justify-center">Qty{getSortIcon('qty')}</div>
              </th>
              <th onClick={() => requestSort('purchase_price')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Purchase Price{getSortIcon('purchase_price')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Expiry</th>
              <th onClick={() => requestSort('current_selling_price')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Sales Price{getSortIcon('current_selling_price')}</div>
              </th>
              <th onClick={() => requestSort('shipping')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Shipping{getSortIcon('shipping')}</div>
              </th>
              <th onClick={() => requestSort('total_amount')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Total{getSortIcon('total_amount')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedPurchases.map((purchase) => {
              const product = products.find(p => p.id === purchase.product_id);
              const masterProduct = masterProducts.find(m => m.name.toLowerCase() === (product?.name || '').toLowerCase());
              const displayCode = masterProduct?.productCode || product?.productCode || '-';
              const supplier = suppliers.find(s => s.id === purchase.supplierId);
              const category = categories.find(c => c.id === purchase.categoryId);
              return (
                <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {format(new Date(purchase.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs font-mono">{displayCode}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{product?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{category?.name || '-'}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{supplier?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-center font-bold text-pink-600">{purchase.qty}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatMMK(purchase.purchase_price)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold">
                      {purchase.expiryDate || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-pink-600 font-bold">{formatMMK(purchase.current_selling_price)}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatMMK(purchase.shipping)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{formatMMK(purchase.total_amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(purchase);
                        }} 
                        className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
                        title="Edit Purchase"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm({ isOpen: true, purchase });
                        }} 
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete Purchase"
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-pink-600 text-white shrink-0">
              <h2 className="text-xl font-bold">{editingPurchase ? 'Edit Purchase' : 'Record New Purchase'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Purchase Date</label>
                  <input required type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.date || ''} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 underline decoration-pink-500 underline-offset-4 decoration-2">Expiry Date (MM/YYYY)</label>
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
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Product</label>
                  <div className="relative w-1/2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-pink-500 outline-none"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                </div>
                <select 
                  required 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                  value={formData.product_id || ''} 
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const mp = masterProducts.find(p => p.id === selectedId);
                    setFormData({ 
                      ...formData, 
                      product_id: selectedId,
                      productCode: mp?.productCode || ''
                    });
                  }}
                >
                  <option value="">Select Product from Master</option>
                  {masterProducts
                    .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.productCode && p.productCode.toLowerCase().includes(productSearch.toLowerCase())))
                    .map(p => {
                      const codeDisplay = p.productCode ? ` (${p.productCode})` : '';
                      const brandDisplay = p.brand ? ` - ${p.brand}` : '';
                      const dosageDisplay = p.dosage ? ` - ${p.dosage}` : '';
                      const unitDisplay = p.unitCount ? ` - ${p.unitCount}` : '';
                      const formDisplay = p.dosageForm ? ` - ${p.dosageForm}` : '';
                      return <option key={p.id} value={p.id}>{p.name}{brandDisplay}{dosageDisplay}{unitDisplay}{formDisplay}{codeDisplay}</option>;
                    })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Product Code</label>
                  <input 
                    type="text" 
                    readOnly 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none font-mono"
                    value={formData.productCode} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Quantity</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.qty || 0} onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Purchase Price</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.purchase_price || 0} onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Sales Price</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.current_selling_price || 0} onChange={(e) => setFormData({ ...formData, current_selling_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Shipping Cost</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.shipping || 0} onChange={(e) => setFormData({ ...formData, shipping: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between sticky bottom-0 bg-white pt-4">
                <div className="text-sm text-slate-500">
                  Total: <span className="text-lg font-bold text-slate-900">{formatMMK((formData.qty * formData.purchase_price) + formData.shipping)}</span>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100">
                    {editingPurchase ? 'Update Purchase' : 'Record Purchase'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Purchase Record"
        message="Are you sure you want to delete this purchase record? Product stock will be adjusted accordingly."
        onConfirm={() => deleteConfirm.purchase && handleDelete(deleteConfirm.purchase)}
        onCancel={() => setDeleteConfirm({ isOpen: false, purchase: null })}
        confirmText="Delete Record"
      />
    </div>
  );
}
