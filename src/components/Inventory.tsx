import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Search, Filter, MoreVertical, Trash2, Edit2, AlertCircle, Calendar, Package, AlertTriangle } from 'lucide-react';
import { cn, handleFirestoreError, OperationType, formatMMK } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';

interface Product {
  id: string;
  name: string;
  categoryId: string;
  supplierId: string;
  landedCost: number;
  sellingPrice: number;
  margin: number;
  stock: number;
  expiryDate: string;
  purchaseDate: string;
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

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
    categoryId: '',
    supplierId: '',
    landedCost: 0,
    sellingPrice: 0,
    stock: 0,
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

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSuppliers();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const margin = formData.sellingPrice - formData.landedCost;
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
      categoryId: product.categoryId,
      supplierId: product.supplierId,
      landedCost: product.landedCost,
      sellingPrice: product.sellingPrice,
      stock: product.stock,
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
      categoryId: '',
      supplierId: '',
      landedCost: 0,
      sellingPrice: 0,
      stock: 0,
      expiryDate: '',
      purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'products');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Products Box Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
          <div className="flex items-center gap-3 mb-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Total Products</h3>
          </div>
          <p className="text-3xl font-black text-indigo-900">{products.length}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">In Stock</h3>
          </div>
          <p className="text-3xl font-black text-emerald-900">{products.reduce((sum, p) => sum + (p.stock > 0 ? 1 : 0), 0)}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wider">Out of Stock</h3>
          </div>
          <p className="text-3xl font-black text-rose-900">{products.reduce((sum, p) => sum + (p.stock <= 0 ? 1 : 0), 0)}</p>
        </div>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">Expiring Soon</h3>
          </div>
          <p className="text-3xl font-black text-amber-900">
            {products.filter(p => p.expiryDate && new Date(p.expiryDate).getTime() < new Date().getTime() + 30 * 24 * 60 * 60 * 1000).length}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Product</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Category</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Supplier</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Landed Cost</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Selling</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Margin (%)</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Stock</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Purchase Date</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((product) => {
              const category = categories.find(c => c.id === product.categoryId);
              const parentCategory = category?.parent ? categories.find(c => c.id === category.parent) : null;
              const categoryDisplay = category 
                ? (parentCategory ? `${parentCategory.name} > ${category.name}` : category.name)
                : '-';
              
              const supplier = suppliers.find(s => s.id === product.supplierId);
              const isLowStock = product.stock < 10;
              const marginPercent = product.landedCost > 0 ? (product.margin / product.landedCost) * 100 : 0;

              return (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{categoryDisplay}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{supplier?.name || '-'}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{formatMMK(product.landedCost)}</td>
                  <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatMMK(product.sellingPrice)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-xs font-bold",
                      product.margin > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {marginPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      isLowStock ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"
                    )}>
                      {product.stock}
                    </span>
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
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="text-xl font-bold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Product Name</label>
                  <input required type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Category</label>
                  <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
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
                  <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}>
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Purchase Date</label>
                  <input required type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Expiry Date</label>
                  <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Landed Cost (MMK)</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.landedCost} onChange={(e) => setFormData({ ...formData, landedCost: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Selling Price (MMK)</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Stock</label>
                  <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={closeModal} className="px-6 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
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
