import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Search, ClipboardList, Package, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import { handleFirestoreError, OperationType, useSortableData } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface ProductDefinition {
  id: string;
  name: string;
  productCode: string;
  brand?: string;
  category?: string;
  dosage?: string;
  unitCount?: string;
  dosageForm?: string;
  createdAt: any;
}

import { notifyUndo } from '../lib/notifications';

export function ProductMaster() {
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDefinition | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; product: ProductDefinition | null }>({
    isOpen: false,
    product: null
  });

  const [formData, setFormData] = useState({
    name: '',
    productCode: '',
    brand: '',
    category: '',
    dosage: '',
    unitCount: '',
    dosageForm: '',
  });

  // Auto-generate name
  useEffect(() => {
    const parts = [
      formData.brand,
      formData.category,
      formData.dosage,
      formData.unitCount,
      formData.dosageForm
    ].filter(Boolean);
    
    setFormData(prev => ({ ...prev, name: parts.join(' ') }));
  }, [formData.brand, formData.category, formData.dosage, formData.unitCount, formData.dosageForm]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productMaster'), (snapshot) => {
      const productList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProductDefinition[];
      setProducts(productList.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'productMaster'));

    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please fill in some details (Brand, Category, etc.) to generate a product name.');
      return;
    }

    // Check for duplicate names or codes
    const isDuplicate = products.some(p => {
      const nameMatch = (p.name || '').toLowerCase() === (formData.name || '').toLowerCase();
      const codeMatch = (p.productCode || '').toLowerCase() === (formData.productCode || '').toLowerCase() && formData.productCode;
      
      return (nameMatch || codeMatch) && (!editingProduct || p.id !== editingProduct.id);
    });

    if (isDuplicate) {
      alert('A product with this name or code already exists.');
      return;
    }

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'productMaster', editingProduct.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'productMaster'), {
          ...formData,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'productMaster');
    }
  };

  const handleDelete = async () => {
    const productToDelete = deleteConfirm.product;
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'productMaster', productToDelete.id));
      setDeleteConfirm({ isOpen: false, product: null });

      notifyUndo({
        message: `Product Template "${productToDelete.name}" deleted`,
        undo: async () => {
          const { id: _, ...data } = productToDelete;
          await addDoc(collection(db, 'productMaster'), {
            ...data,
            createdAt: serverTimestamp(),
            isUndone: true
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'productMaster');
    }
  };

  const openEditModal = (product: ProductDefinition) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      productCode: product.productCode,
      brand: product.brand || '',
      category: product.category || '',
      dosage: product.dosage || '',
      unitCount: product.unitCount || '',
      dosageForm: product.dosageForm || '',
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
      category: '',
      dosage: '',
      unitCount: '',
      dosageForm: '',
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const { items: sortedProducts, requestSort, sortConfig } = useSortableData(filteredProducts, { key: 'name', direction: 'asc' });

  const exportToExcel = () => {
    const data = sortedProducts.map(p => ({
      'Product Code': p.productCode,
      'Product Name': p.name,
      'Brand': p.brand || '',
      'Category': p.category || '',
      'Dosage': p.dosage || '',
      'Unit Count': p.unitCount || '',
      'Dosage Form': p.dosageForm || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ProductMaster');
    XLSX.writeFile(wb, `product_master_export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-pink-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-pink-600" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-pink-500" />
            Product Master
          </h1>
          <p className="text-slate-500 text-sm mt-1">Define product names and codes for reuse across the app.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-100 font-semibold"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
          <button 
            onClick={() => {
              setFormData({ ...formData, productCode: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-pink-100 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Master Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products by name, brand or code..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th onClick={() => requestSort('brand')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                  <div className="flex items-center">Brand{getSortIcon('brand')}</div>
                </th>
                <th onClick={() => requestSort('name')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                  <div className="flex items-center">Full Product Name{getSortIcon('name')}</div>
                </th>
                <th onClick={() => requestSort('productCode')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                  <div className="flex items-center">Product Code{getSortIcon('productCode')}</div>
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-900">{product.brand || '-'}</td>
                  <td className="px-6 py-4 text-slate-700">{product.name}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-sm">{product.productCode}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(product)}
                        className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, product })}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No products found. Add your first master product to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-pink-50/50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-pink-600" />
                {editingProduct ? 'Edit Master Product' : 'Add Master Product'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Brand</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                    value={formData.brand || ''} 
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })} 
                    placeholder="e.g. Nature's Bounty"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Category / Sub-category</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                    value={formData.category || ''} 
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
                    placeholder="e.g. Vitamin C"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Dosage</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                    value={formData.dosage || ''} 
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} 
                    placeholder="e.g. 500mg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Unit Count</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                    value={formData.unitCount || ''} 
                    onChange={(e) => setFormData({ ...formData, unitCount: e.target.value })} 
                    placeholder="e.g. 100 Count"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Dosage Form</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                    value={formData.dosageForm || ''} 
                    onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })} 
                    placeholder="e.g. Capsules"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Product Code / SKU</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none font-mono" 
                    value={formData.productCode || ''} 
                    onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                    placeholder="e.g. CEN-A50-L25"
                  />
                </div>
              </div>

              <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Auto-generated Full Name</label>
                <div className="text-lg font-bold text-slate-900 min-h-[1.75rem]">
                  {formData.name || <span className="text-slate-300 italic font-normal">Fill in the fields above...</span>}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 font-semibold shadow-lg shadow-pink-100"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onCancel={() => setDeleteConfirm({ isOpen: false, product: null })}
        onConfirm={handleDelete}
        title="Delete Master Product"
        message={`Are you sure you want to delete "${deleteConfirm.product?.name}"? This will not affect existing inventory but will remove it from the master list.`}
      />
    </div>
  );
}
