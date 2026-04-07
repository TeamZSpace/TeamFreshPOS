import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Receipt, Trash2, Calendar, DollarSign, Tag, Edit2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { handleFirestoreError, OperationType, formatMMK, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
}

export function Expense() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });
  const [formData, setFormData] = useState({
    category: '',
    amount: 0,
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const categories = ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Shipping', 'Packaging', 'Software', 'Other'];

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...formData,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingExpense ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    }
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormData({
      category: exp.category,
      amount: exp.amount,
      description: exp.description,
      date: exp.date,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({ category: '', amount: 0, description: '', date: format(new Date(), 'yyyy-MM-dd') });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'expenses');
    }
  };

  const { items: sortedExpenses, requestSort, sortConfig } = useSortableData(expenses, { key: 'date', direction: 'desc' });

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-purple-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-purple-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-purple-600" />
          Business Expenses
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
          <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-1">Total Expenses</p>
          <p className="text-2xl font-black text-purple-900">{formatMMK(expenses.reduce((sum, e) => sum + e.amount, 0))}</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th onClick={() => requestSort('date')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Date{getSortIcon('date')}</div>
              </th>
              <th onClick={() => requestSort('category')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Category{getSortIcon('category')}</div>
              </th>
              <th onClick={() => requestSort('description')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Description{getSortIcon('description')}</div>
              </th>
              <th onClick={() => requestSort('amount')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Amount{getSortIcon('amount')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedExpenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 text-slate-600 text-xs">{format(new Date(expense.date), 'MMM d, yyyy')}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-900 text-sm">{expense.description}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">{formatMMK(expense.amount)}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(expense);
                      }} 
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Edit Expense"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ isOpen: true, id: expense.id });
                      }} 
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete Expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-purple-600 text-white">
              <h2 className="text-xl font-bold">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Date</label>
                <input required type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Category</label>
                <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Amount (MMK)</label>
                <input required type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Description</label>
                <textarea rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-lg shadow-purple-100">
                  {editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record? This action cannot be undone."
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
        confirmText="Delete Expense"
      />
    </div>
  );
}
