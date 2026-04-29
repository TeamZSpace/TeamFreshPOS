import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Users, Plus, Search, Mail, Phone, Percent, DollarSign, Edit2, Trash2, Shield, User, AlertTriangle, TrendingUp, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType, myanmarToEnglishNumerals } from '../lib/utils';
import { notifyUndo } from '../lib/notifications';
import { ConfirmModal } from './ConfirmModal';

interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string;
  share: number; // percentage
  investment: number;
  joinedAt: any;
  note?: string;
}

export function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    share: 0,
    investment: 0,
    note: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'partners'), orderBy('share', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
        setPartners(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'partners')
    );
    return unsubscribe;
  }, []);

  const totalInvestment = partners.reduce((sum, p) => sum + (p.investment || 0), 0);
  const totalShares = partners.reduce((sum, p) => sum + (p.share || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPartner) {
        await updateDoc(doc(db, 'partners', editingPartner.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'partners'), {
          ...formData,
          joinedAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingPartner ? OperationType.UPDATE : OperationType.CREATE, 'partners');
    }
  };

  const handleDelete = async () => {
    if (!partnerToDelete) return;
    try {
      const partner = partnerToDelete;
      await deleteDoc(doc(db, 'partners', partner.id));
      notifyUndo({
        message: `Partner ${partner.name} removed`,
        undo: async () => {
          await addDoc(collection(db, 'partners'), {
            name: partner.name,
            email: partner.email,
            phone: partner.phone,
            share: partner.share,
            investment: partner.investment,
            note: partner.note,
            joinedAt: partner.joinedAt
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'partners');
    }
  };

  const confirmDelete = (partner: Partner) => {
    setPartnerToDelete(partner);
    setIsDeleteModalOpen(true);
  };

  const openModal = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        share: partner.share,
        investment: partner.investment,
        note: partner.note || ''
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        share: 0,
        investment: 0,
        note: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPartner(null);
  };

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-20 sm:pb-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partners & Shareholders</h1>
          <p className="text-slate-500 text-sm">Manage business ownership and investments</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-pink-500 text-white font-bold rounded-xl hover:bg-pink-600 transition-all shadow-lg shadow-pink-200"
        >
          <Plus className="w-5 h-5" />
          Add Stakeholder
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-slate-500 uppercase">Total Partners</span>
          </div>
          <p className="text-3xl font-black text-slate-900">{partners.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-semibold text-slate-500 uppercase">Total Investment</span>
          </div>
          <p className="text-3xl font-black text-slate-900">{totalInvestment.toLocaleString()} MMK</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
              <Percent className="w-5 h-5 text-pink-600" />
            </div>
            <span className="text-sm font-semibold text-slate-500 uppercase">Total Shares</span>
          </div>
          <p className={cn(
            "text-3xl font-black",
            totalShares > 100 ? "text-rose-600" : "text-slate-900"
          )}>{totalShares}%</p>
          {totalShares > 100 && (
            <div className="flex items-center gap-1 mt-2 text-rose-500 text-xs font-bold uppercase">
              <AlertTriangle className="w-3 h-3" />
              Exceeds 100%!
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search partner by name or contact..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Partner</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Investment</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Equity Share</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPartners.map((partner) => (
                <tr key={partner.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-pink-100 group-hover:text-pink-600 transition-colors">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{partner.name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {partner.phone}</span>
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {partner.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-sm font-bold text-slate-900">{partner.investment.toLocaleString()} MMK</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Funding Amount</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <p className="font-black text-lg text-pink-600">{partner.share}%</p>
                       <div className="flex-1 max-w-[60px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-pink-500 rounded-full" 
                            style={{ width: `${partner.share}%` }}
                          />
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openModal(partner)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-95"
                        title="Edit Partner"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => confirmDelete(partner)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                        title="Remove Partner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPartners.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No partners found</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Remove Partner"
        message={`Are you sure you want to remove ${partnerToDelete?.name} as a business partner? This action will remove their equity record.`}
        onConfirm={handleDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setPartnerToDelete(null);
        }}
        confirmText="Remove Partner"
        cancelText="Keep Partner"
      />

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">{editingPartner ? 'Edit Stakeholder' : 'Add New Stakeholder'}</h3>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">Email Address</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                      value={formData.email || ''} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">Phone Number</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                      value={formData.phone || ''} 
                      onChange={e => setFormData({...formData, phone: myanmarToEnglishNumerals(e.target.value)})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">Investment Amount (MMK)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required 
                        type="number" 
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                        value={formData.investment || 0} 
                        onChange={e => setFormData({...formData, investment: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">Equity Share (%)</label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required 
                        type="number" 
                        step="0.01"
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                        value={formData.share || 0} 
                        onChange={e => setFormData({...formData, share: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Internal Notes</label>
                  <textarea 
                    rows={3} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none" 
                    value={formData.note || ''} 
                    onChange={e => setFormData({...formData, note: e.target.value})} 
                    placeholder="Partner specific terms or notes..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-pink-500 text-white font-bold rounded-xl hover:bg-pink-600 transition-colors shadow-lg shadow-pink-100">
                    {editingPartner ? 'Update Partner' : 'Confirm Stakeholder'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
