import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Receipt, Trash2, Calendar, DollarSign, Tag, Edit2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Camera, Image as ImageIcon, X } from 'lucide-react';
import { handleFirestoreError, OperationType, formatMMK, useSortableData, cn } from '../lib/utils';
import { format, isSameMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';
import * as XLSX from 'xlsx';

interface ExpenseItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  items: ExpenseItem[];
  voucherImage?: string;
  createdAt?: any;
}

import { notifyUndo } from '../lib/notifications';

export function Expense() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAllTime, setShowAllTime] = useState(false);
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
    items: [{ description: '', qty: 1, unitPrice: 0, total: 0 }] as ExpenseItem[],
    voucherImage: ''
  });

  const categories = ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Shipping', 'Packaging', 'Software', 'Delivery Charges', 'Other'];

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', qty: 1, unitPrice: 0, total: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, amount: newTotal });
  };

  const updateItem = (index: number, field: keyof ExpenseItem, value: any) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'qty' || field === 'unitPrice') {
      const qty = field === 'qty' ? parseFloat(value) || 0 : item.qty;
      const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : item.unitPrice;
      item.total = qty * unitPrice;
    }

    newItems[index] = item;
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, amount: newTotal });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for Firestore doc safety
        alert('Image size is too large. Please select an image smaller than 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, voucherImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, voucherImage: '' }));
  };

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
      description: exp.description || '',
      date: exp.date,
      items: exp.items || [{ description: exp.description, qty: 1, unitPrice: exp.amount, total: exp.amount }],
      voucherImage: exp.voucherImage || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({ 
      category: '', 
      amount: 0, 
      description: '', 
      date: format(new Date(), 'yyyy-MM-dd'),
      items: [{ description: '', qty: 1, unitPrice: 0, total: 0 }],
      voucherImage: ''
    });
  };

  const handleDelete = async (id: string) => {
    const expenseToDelete = expenses.find(e => e.id === id);
    if (!expenseToDelete) return;

    try {
      await deleteDoc(doc(db, 'expenses', id));
      
      notifyUndo({
        message: `Expense of ${formatMMK(expenseToDelete.amount)} deleted`,
        undo: async () => {
          const { id: _, ...data } = expenseToDelete;
          await addDoc(collection(db, 'expenses'), {
            ...data,
            createdAt: serverTimestamp(),
            isUndone: true
          });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'expenses');
    }
  };

  const { items: sortedExpenses, requestSort, sortConfig } = useSortableData(expenses, { key: 'createdAt', direction: 'desc' });

  const monthlyExpenses = expenses.filter(e => isSameMonth(new Date(e.date), selectedMonth));
  const currentMonthTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const allTimeTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const months = eachMonthOfInterval({
    start: subMonths(new Date(), 11),
    end: new Date()
  }).reverse();

  const displayExpenses = showAllTime ? sortedExpenses : sortedExpenses.filter(e => isSameMonth(new Date(e.date), selectedMonth));

  const exportToExcel = () => {
    const data = displayExpenses.flatMap(e => {
      if (e.items && e.items.length > 0) {
        return e.items.map(item => ({
          'Date': e.date,
          'Category': e.category,
          'Description': item.description,
          'Qty': item.qty,
          'Unit Price': item.unitPrice,
          'Total': item.total,
          'Voucher Note': e.description
        }));
      }
      return [{
        'Date': e.date,
        'Category': e.category,
        'Description': e.description,
        'Qty': 1,
        'Unit Price': e.amount,
        'Total': e.amount,
        'Voucher Note': ''
      }];
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `expenses_export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-pink-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-pink-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-pink-600" />
          Business Expenses
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setShowAllTime(false)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                !showAllTime ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setShowAllTime(true)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                showAllTime ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              All Time
            </button>
          </div>

          {!showAllTime && (
            <select 
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-pink-500 outline-none shadow-sm"
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

          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-pink-50 text-pink-600 border border-pink-200 rounded-xl font-semibold hover:bg-pink-100 transition-all shadow-sm group"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100"
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-pink-600 p-6 rounded-2xl shadow-lg shadow-pink-100 text-white">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">
              {showAllTime ? "All Time Total" : `${format(selectedMonth, 'MMMM')} Total`}
            </p>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <p className="text-3xl font-black">{formatMMK(showAllTime ? allTimeTotal : currentMonthTotal)}</p>
        </div>

        {!showAllTime && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction Count</p>
              <Receipt className="w-5 h-5 text-pink-600" />
            </div>
            <p className="text-3xl font-black text-slate-900">{monthlyExpenses.length}</p>
            <p className="text-xs text-slate-500 mt-1">Expenses in {format(selectedMonth, 'MMM')}</p>
          </div>
        )}

        {showAllTime && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lifetime Records</p>
              <Calendar className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-3xl font-black">{expenses.length}</p>
            <p className="text-xs text-slate-500 mt-1">Total entries logged</p>
          </div>
        )}
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
            {displayExpenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 text-slate-600 text-xs">{format(new Date(expense.date), 'MMM d, yyyy')}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-pink-50 text-pink-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {expense.voucherImage && (
                      <div className="relative group/img cursor-pointer" onClick={() => openEditModal(expense)}>
                        <img 
                          src={expense.voucherImage} 
                          alt="Voucher" 
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200" 
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                          <ImageIcon className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-slate-900 text-sm font-medium">{expense.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {expense.items?.map((item, idx) => (
                          <span key={idx} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.qty}x {item.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">{formatMMK(expense.amount)}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(expense);
                      }} 
                      className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-pink-600 text-white">
              <h2 className="text-xl font-bold">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Date</label>
                  <input required type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Category</label>
                  <select required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Voucher Items</h3>
                  <button 
                    type="button" 
                    onClick={addItem}
                    className="flex items-center gap-1.5 px-3 py-1 bg-pink-50 text-pink-600 rounded-lg text-xs font-bold hover:bg-pink-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative group">
                      {formData.items.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeItem(index)}
                          className="absolute -top-2 -right-2 p-1.5 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                        >
                          <Plus className="w-3 h-3 rotate-45" />
                        </button>
                      )}
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Item Description</label>
                        <input 
                          required 
                          placeholder="What did you buy?"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none" 
                          value={item.description} 
                          onChange={e => updateItem(index, 'description', e.target.value)} 
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                          <input 
                            required 
                            type="number" 
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none" 
                            value={item.qty} 
                            onChange={e => updateItem(index, 'qty', e.target.value)} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Unit Price</label>
                          <input 
                            required 
                            type="number" 
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none" 
                            value={item.unitPrice} 
                            onChange={e => updateItem(index, 'unitPrice', e.target.value)} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Total</label>
                          <div className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
                            {formatMMK(item.total)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-600">Total Voucher Amount</span>
                  <span className="text-xl font-black text-pink-600">{formatMMK(formData.amount)}</span>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Voucher Remarks (Optional)</label>
                  <textarea 
                    rows={2} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none" 
                    value={formData.description || ''} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-sm font-bold text-slate-800 uppercase tracking-widest block">Attach Voucher Photo</label>
                  {!formData.voucherImage ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-pink-300 transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Camera className="w-8 h-8 text-slate-400 group-hover:text-pink-500 mb-2 transition-colors" />
                        <p className="text-xs text-slate-500 group-hover:text-pink-600 font-medium">Click to upload or take a photo</p>
                        <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 1MB</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  ) : (
                    <div className="relative group">
                      <img 
                        src={formData.voucherImage} 
                        alt="Voucher Preview" 
                        className="w-full h-48 object-cover rounded-2xl border border-slate-200 shadow-sm"
                      />
                      <button 
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100">
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
