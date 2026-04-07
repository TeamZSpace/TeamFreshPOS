import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, runTransaction, deleteDoc } from 'firebase/firestore';
import { Plus, ShoppingCart, Calendar, Truck, DollarSign, Package, Edit2, Trash2, AlertTriangle, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { handleFirestoreError, OperationType, formatMMK, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';

interface Purchase {
  id: string;
  date: string;
  productId: string;
  supplierId: string;
  quantity: number;
  unitCost: number;
  shipping: number;
  totalAmount: number;
}

interface Product {
  id: string;
  name: string;
  productCode?: string;
  brand?: string;
  dosage?: string;
  unitCount?: string;
  dosageForm?: string;
  stock: number;
  landedCost: number;
  categoryId: string;
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

export function Purchase() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; purchase: Purchase | null }>({
    isOpen: false,
    purchase: null
  });
  const [formData, setFormData] = useState({
    productId: '',
    supplierId: '',
    quantity: 0,
    unitCost: 0,
    shipping: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
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

    return () => {
      unsubPurchases();
      unsubProducts();
      unsubSuppliers();
      unsubCategories();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAmount = (formData.quantity * formData.unitCost) + formData.shipping;
      const newLandedCost = totalAmount / formData.quantity;

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', formData.productId);
        const productDoc = await transaction.get(productRef);
        
        if (!productDoc.exists()) throw new Error("Product not found");
        
        const currentData = productDoc.data() as Product;
        
        if (editingPurchase) {
          // Revert old purchase stock first
          const stockDiff = formData.quantity - editingPurchase.quantity;
          transaction.update(productRef, {
            stock: currentData.stock + stockDiff,
            landedCost: newLandedCost,
            purchaseDate: formData.date
          });
          transaction.update(doc(db, 'purchases', editingPurchase.id), {
            ...formData,
            totalAmount,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.update(productRef, {
            stock: currentData.stock + formData.quantity,
            landedCost: newLandedCost,
            purchaseDate: formData.date
          });
          const purchaseRef = doc(collection(db, 'purchases'));
          transaction.set(purchaseRef, {
            ...formData,
            totalAmount,
            createdAt: serverTimestamp(),
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
      productId: p.productId,
      supplierId: p.supplierId,
      quantity: p.quantity,
      unitCost: p.unitCost,
      shipping: p.shipping,
      date: p.date.split('T')[0],
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
    setFormData({ productId: '', supplierId: '', quantity: 0, unitCost: 0, shipping: 0, date: format(new Date(), 'yyyy-MM-dd') });
  };

  const handleDelete = async (purchase: Purchase) => {
    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', purchase.productId);
        const productDoc = await transaction.get(productRef);
        if (productDoc.exists()) {
          transaction.update(productRef, {
            stock: productDoc.data().stock - purchase.quantity
          });
        }
        transaction.delete(doc(db, 'purchases', purchase.id));
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'purchases');
    }
  };

  const { items: sortedPurchases, requestSort, sortConfig } = useSortableData(purchases, { key: 'date', direction: 'desc' });

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-amber-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-amber-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-amber-600" />
          Purchase History
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100"
        >
          <Plus className="w-5 h-5" />
          New Purchase
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th onClick={() => requestSort('date')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Date{getSortIcon('date')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Supplier</th>
              <th onClick={() => requestSort('quantity')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-center cursor-pointer group">
                <div className="flex items-center justify-center">Quantity{getSortIcon('quantity')}</div>
              </th>
              <th onClick={() => requestSort('unitCost')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Unit Cost{getSortIcon('unitCost')}</div>
              </th>
              <th onClick={() => requestSort('shipping')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Shipping{getSortIcon('shipping')}</div>
              </th>
              <th onClick={() => requestSort('totalAmount')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Total{getSortIcon('totalAmount')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedPurchases.map((purchase) => {
              const product = products.find(p => p.id === purchase.productId);
              const supplier = suppliers.find(s => s.id === purchase.supplierId);
              return (
                <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 text-xs">
                    {format(new Date(purchase.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{product?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{supplier?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-center font-bold text-indigo-600">{purchase.quantity}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatMMK(purchase.unitCost)}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatMMK(purchase.shipping)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{formatMMK(purchase.totalAmount)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(purchase);
                        }} 
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-600 text-white">
              <h2 className="text-xl font-bold">{editingPurchase ? 'Edit Purchase' : 'Record New Purchase'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Purchase Date</label>
                <input required type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-700">Product</label>
                  <div className="relative w-1/2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                </div>
                <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })}>
                  <option value="">Select Product</option>
                  {products
                    .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.productCode && p.productCode.toLowerCase().includes(productSearch.toLowerCase())))
                    .map(p => {
                      const category = categories.find(c => c.id === p.categoryId);
                      const catDisplay = category ? ` [${category.name}]` : '';
                      const codeDisplay = p.productCode ? ` (${p.productCode})` : '';
                      const brandDisplay = p.brand ? ` - ${p.brand}` : '';
                      const dosageDisplay = p.dosage ? ` - ${p.dosage}` : '';
                      const unitDisplay = p.unitCount ? ` - ${p.unitCount}` : '';
                      const formDisplay = p.dosageForm ? ` - ${p.dosageForm}` : '';
                      return <option key={p.id} value={p.id}>{p.name}{brandDisplay}{dosageDisplay}{unitDisplay}{formDisplay}{codeDisplay}{catDisplay}</option>;
                    })}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Supplier</label>
                <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}>
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Quantity</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Unit Cost (MMK)</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" value={formData.unitCost} onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Shipping Cost (MMK)</label>
                <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" value={formData.shipping} onChange={(e) => setFormData({ ...formData, shipping: parseFloat(e.target.value) })} />
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  Total: <span className="text-lg font-bold text-slate-900">{formatMMK((formData.quantity * formData.unitCost) + formData.shipping)}</span>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100">
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
