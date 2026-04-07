import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, Tags, Trash2, Layers, Edit2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { handleFirestoreError, OperationType, useSortableData } from '../lib/utils';
import { ConfirmModal } from './ConfirmModal';

interface Category {
  id: string;
  name: string;
  parent: string | null;
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    parent: '' as string | null,
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), {
          ...formData,
          parent: formData.parent === '' ? null : formData.parent,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'categories'), {
          ...formData,
          parent: formData.parent === '' ? null : formData.parent,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingCategory ? OperationType.UPDATE : OperationType.CREATE, 'categories');
    }
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      parent: cat.parent || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: '', parent: '' });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'categories');
    }
  };

  const { items: sortedCategories, requestSort, sortConfig } = useSortableData(categories, { key: 'name', direction: 'asc' });

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-emerald-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-emerald-600" />;
  };

  const mainCategories = sortedCategories.filter(c => !c.parent);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Tags className="w-6 h-6 text-emerald-600" />
          Product Categories
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" />
          New Category
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sort By:</span>
            <select 
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
              value={sortConfig?.key || ''}
              onChange={(e) => requestSort(e.target.value)}
            >
              <option value="name">Name</option>
            </select>
            <button 
              onClick={() => requestSort(sortConfig?.key || 'name')}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
            >
              {sortConfig?.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-emerald-600" /> : <ArrowDown className="w-4 h-4 text-emerald-600" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mainCategories.map((main) => (
          <div key={main.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col group relative">
            <div className="absolute top-4 right-4 flex gap-1">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(main);
                }} 
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-slate-100"
                title="Edit Category"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ isOpen: true, id: main.id, name: main.name });
                }} 
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-slate-100"
                title="Delete Category"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Layers className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900">{main.name}</h3>
            </div>

            <div className="space-y-2 flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sub-categories</p>
              {sortedCategories.filter(c => c.parent === main.id).map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group/sub">
                  <span className="text-sm text-slate-600">{sub.name}</span>
                  <div className="flex gap-1">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(sub);
                      }} 
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Edit Sub-category"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ isOpen: true, id: sub.id, name: sub.name });
                      }} 
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Sub-category"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {sortedCategories.filter(c => c.parent === main.id).length === 0 && (
                <p className="text-xs text-slate-400 italic">No sub-categories</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
              <h2 className="text-xl font-bold">{editingCategory ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Category Name</label>
                <input required type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Parent Category (Optional)</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={formData.parent || ''} onChange={e => setFormData({...formData, parent: e.target.value || null})}>
                  <option value="">None (Main Category)</option>
                  {mainCategories.filter(c => c.id !== editingCategory?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Category"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? This will also affect products linked to this category.`}
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        confirmText="Delete Category"
      />
    </div>
  );
}
