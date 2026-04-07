import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Search, ClipboardList, Package, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { handleFirestoreError, OperationType, useSortableData } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';

interface ProductDefinition {
  id: string;
  name: string;
  productCode: string;
  brand?: string;
  category?: string;
  dosage?: string;
  unitCount?: string;
  dosageForm?: string;
  type: 'Packing' | 'Travel';
  createdAt: any;
}

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
    type: 'Packing' as 'Packing' | 'Travel',
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

  const generateNextCode = (type: 'Packing' | 'Travel') => {
    const prefix = type === 'Packing' ? 'PC-' : 'PCT-';
    const existingCodes = products
      .filter(p => p.productCode.startsWith(prefix))
      .map(p => {
        const numPart = p.productCode.replace(prefix, '');
        return parseInt(numPart, 10);
      })
      .filter(n => !isNaN(n));

    const nextNum = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  };

  const handleTypeChange = (type: 'Packing' | 'Travel') => {
    const nextCode = generateNextCode(type);
    setFormData({ ...formData, type, productCode: nextCode });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicate names or codes
    const isDuplicate = products.some(p => 
      (p.name.toLowerCase() === formData.name.toLowerCase() || p.productCode.toLowerCase() === formData.productCode.toLowerCase()) && 
      (!editingProduct || p.id !== editingProduct.id)
    );

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
    if (!deleteConfirm.product) return;
    try {
      await deleteDoc(doc(db, 'productMaster', deleteConfirm.product.id));
      setDeleteConfirm({ isOpen: false, product: null });
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
      type: product.type || 'Packing',
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
      type: 'Packing',
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const { items: sortedProducts, requestSort, sortConfig } = useSortableData(filteredProducts, { key: 'name', direction: 'asc' });

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-rose-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-rose-600" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-rose-500" />
            Product Master
          </h1>
          <p className="text-slate-500 text-sm mt-1">Define product names and codes for reuse across the app.</p>
        </div>
        <button 
          onClick={() => {
            const nextCode = generateNextCode('Packing');
            setFormData({ ...formData, type: 'Packing', productCode: nextCode });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-rose-100 font-semibold"
        >
          <Plus className="w-5 h-5" />
          Add Master Product
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products by name, brand or code..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
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
                <th onClick={() => requestSort('type')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                  <div className="flex items-center">Type{getSortIcon('type')}</div>
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
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      product.type === 'Travel' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {product.type || 'Packing'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-sm">{product.productCode}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(product)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-rose-600" />
                {editingProduct ? 'Edit Master Product' : 'Add Master Product'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Product Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('Packing')}
                    className={`px-4 py-2 rounded-xl border-2 transition-all font-semibold text-sm ${
                      formData.type === 'Packing' 
                        ? 'border-rose-500 bg-rose-50 text-rose-700' 
                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    Packing (PC)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('Travel')}
                    className={`px-4 py-2 rounded-xl border-2 transition-all font-semibold text-sm ${
                      formData.type === 'Travel' 
                        ? 'border-rose-500 bg-rose-50 text-rose-700' 
                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    Travel Size (PCT)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Brand</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" 
                    value={formData.brand} 
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })} 
                    placeholder="e.g. Nature's Bounty"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Category / Sub-category</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" 
                    value={formData.category} 
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
                    placeholder="e.g. Vitamin C"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Dosage</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" 
                    value={formData.dosage} 
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} 
                    placeholder="e.g. 500mg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Unit Count</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" 
                    value={formData.unitCount} 
                    onChange={(e) => setFormData({ ...formData, unitCount: e.target.value })} 
                    placeholder="e.g. 100 Count"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Dosage Form</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" 
                    value={formData.dosageForm} 
                    onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })} 
                    placeholder="e.g. Capsules"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Product Code / SKU</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none bg-slate-50 font-mono" 
                    value={formData.productCode} 
                    readOnly
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
                  className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-semibold shadow-lg shadow-rose-100"
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
