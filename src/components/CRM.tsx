import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Users, Search, Phone, MapPin, Calendar, Facebook, User, Award, Trash2, Edit2, Plus, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Filter, ShoppingBag } from 'lucide-react';
import { handleFirestoreError, OperationType, myanmarToEnglishNumerals, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';

interface Customer {
  id: string;
  facebookName: string;
  orderName: string;
  phone: string;
  address: string;
  lastOrderDate: string;
  points: number;
  orderCount?: number;
}

export function CRM() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: ''
  });
  const [formData, setFormData] = useState({
    facebookName: '',
    orderName: '',
    phone: '',
    address: '',
    points: 0,
    orderCount: 0,
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'customers'), orderBy('lastOrderDate', 'desc')), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const englishPhone = myanmarToEnglishNumerals(formData.phone);
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), {
          ...formData,
          phone: englishPhone,
          updatedAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'customers');
    }
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      facebookName: c.facebookName,
      orderName: c.orderName || '',
      phone: c.phone || '',
      address: c.address || '',
      points: c.points || 0,
      orderCount: c.orderCount || 0,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({ facebookName: '', orderName: '', phone: '', address: '', points: 0, orderCount: 0 });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'customers');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.facebookName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.orderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const { items: sortedCustomers, requestSort, sortConfig } = useSortableData(filteredCustomers, { key: 'lastOrderDate', direction: 'desc' });

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-blue-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-blue-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Customer Relationship Management
        </h2>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sort By:</span>
            <select 
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
              value={sortConfig?.key || ''}
              onChange={(e) => requestSort(e.target.value)}
            >
              <option value="facebookName">FB Name</option>
              <option value="points">Points</option>
              <option value="lastOrderDate">Last Order</option>
            </select>
            <button 
              onClick={() => requestSort(sortConfig?.key || 'lastOrderDate')}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
            >
              {sortConfig?.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600" /> : <ArrowDown className="w-4 h-4 text-blue-600" />}
            </button>
          </div>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedCustomers.map((customer) => (
          <div key={customer.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
            <div className="absolute top-4 right-4 flex gap-1">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(customer);
                }} 
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-slate-100"
                title="Edit Customer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ isOpen: true, id: customer.id, name: customer.facebookName });
                }} 
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-slate-100"
                title="Delete Customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {customer.facebookName}
                    <Facebook className="w-3 h-3 text-blue-500" />
                  </h3>
                  <p className="text-xs text-slate-500">Order Name: {customer.orderName || '-'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                {customer.phone || 'No phone recorded'}
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <span className="line-clamp-2">{customer.address || 'No address recorded'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                Last Order: {customer.lastOrderDate ? format(new Date(customer.lastOrderDate), 'MMM d, yyyy') : 'Never'}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 w-fit">
                  <Award className="w-4 h-4" />
                  <span className="text-xs font-black">{customer.points || 0} Points</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 w-fit">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="text-xs font-black">{customer.orderCount || 0} Orders</span>
                </div>
              </div>
              <button className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                View History →
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-600 text-white">
              <h2 className="text-xl font-bold">Edit Customer</h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Facebook Name</label>
                <input required type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.facebookName} onChange={e => setFormData({...formData, facebookName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Order Name</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.orderName} onChange={e => setFormData({...formData, orderName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Phone</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: myanmarToEnglishNumerals(e.target.value)})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Points</label>
                  <input type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.points} onChange={e => setFormData({...formData, points: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Orders</label>
                  <input type="number" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={formData.orderCount} onChange={e => setFormData({...formData, orderCount: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Address</label>
                <textarea rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">Update Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? All customer history and points will be permanently lost.`}
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        confirmText="Delete Customer"
      />
    </div>
  );
}
