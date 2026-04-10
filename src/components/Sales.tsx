import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, runTransaction, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Plus, TrendingUp, User, ShoppingBag, MapPin, CreditCard, Calendar, Trash2, Search, Edit2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn, handleFirestoreError, OperationType, formatMMK, myanmarToEnglishNumerals, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';

interface Sale {
  id: string;
  orderNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  items: { productId: string; name: string; quantity: number; price: number }[];
  paymentMethod: string;
  address: string;
  deliveryDate: string;
  subtotal: number;
  deliveryFees: number;
  totalAmount: number;
  note?: string;
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
  sellingPrice: number;
  categoryId: string;
}

interface Category {
  id: string;
  name: string;
  parent: string | null;
}

interface Customer {
  id: string;
  facebookName: string;
  orderName: string;
  phone: string;
  address: string;
  points: number;
  orderCount?: number;
}

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sale: Sale | null }>({
    isOpen: false,
    sale: null
  });
  
  const [formData, setFormData] = useState({
    facebookName: '',
    orderName: '',
    phone: '',
    paymentMethod: 'Kpay',
    address: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    deliveryDate: format(new Date(), 'yyyy-MM-dd'),
    deliveryFees: 0,
    note: '',
    items: [] as { productId: string; name: string; quantity: number; price: number }[],
  });
  const [productSearch, setProductSearch] = useState('');

  const paymentMethods = ['Kpay', 'WavePay', 'AYAPay', 'uabpay', 'Bank', 'Cash', 'Credit', 'COD (Cash on Deli)'];

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    return () => {
      unsubSales();
      unsubProducts();
      unsubCustomers();
      unsubCategories();
    };
  }, []);

  const handleAddItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = formData.items.find(item => item.productId === productId);
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert(`Only ${product.stock} units of "${product.name}" are available in stock.`);
        return;
      }
      setFormData({
        ...formData,
        items: formData.items.map(item => 
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        )
      });
    } else {
      if (product.stock <= 0) {
        alert(`"${product.name}" is out of stock.`);
        return;
      }
      setFormData({
        ...formData,
        items: [...formData.items, { productId, name: product.name, quantity: 1, price: product.sellingPrice }]
      });
    }
  };

  const handleRemoveItem = (productId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.productId !== productId)
    });
  };

  const generateOrderNumber = async (dateStr: string) => {
    const saleDate = new Date(dateStr);
    const mm = String(saleDate.getMonth() + 1).padStart(2, '0');
    const yy = String(saleDate.getFullYear()).slice(-2);
    const prefix = `${mm}${yy}`;
    
    const monthSales = sales.filter(s => s.orderNumber?.startsWith(prefix));
    const nextNum = String(monthSales.length + 1).padStart(4, '0');
    return `${prefix}${nextNum}`;
  };

  const downloadOrderNote = (saleData: any) => {
    const itemsText = saleData.items.map((item: any) => `- ${item.name} x ${item.quantity} (${formatMMK(item.price)})`).join('\n');
    const noteText = saleData.note ? `\nNOTE:\n${saleData.note}\n` : '';
    const note = `
ORDER NOTE
-----------
Order Number: ${saleData.orderNumber}
Date: ${saleData.date}
Customer: ${saleData.customerName}
Phone: ${formData.phone}
Address: ${saleData.address}
Payment: ${saleData.paymentMethod}
Delivery Date: ${saleData.deliveryDate}
${noteText}
ITEMS:
${itemsText}

Product Sales Total: ${formatMMK(saleData.subtotal)}
Delivery Fees: ${formatMMK(saleData.deliveryFees)}
TOTAL AMOUNT: ${formatMMK(saleData.totalAmount)}
-----------
Thank you for your order!
    `.trim();

    const blob = new Blob([note], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Order_${saleData.orderNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) return alert('Please add at least one item');
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const subtotal = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const totalAmount = subtotal + formData.deliveryFees;
      const pointsToAdd = Math.floor(subtotal / 100000) * 30;
      const orderNumber = editingSale ? editingSale.orderNumber : await generateOrderNumber(formData.date);
      const englishPhone = myanmarToEnglishNumerals(formData.phone);

      // 1. Handle Customer (CRM) - Query outside transaction
      let customerId = '';
      let existingCustomerData: any = null;
      const customerQuery = query(collection(db, 'customers'), where('facebookName', '==', formData.facebookName));
      const customerSnap = await getDocs(customerQuery);
      
      if (!customerSnap.empty) {
        const customerDoc = customerSnap.docs[0];
        customerId = customerDoc.id;
        existingCustomerData = customerDoc.data();
      }

      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const productDocs: { [id: string]: any } = {};
        
        // Get all unique product IDs involved
        const productIds = new Set<string>();
        if (editingSale) {
          editingSale.items.forEach(item => productIds.add(item.productId));
        }
        formData.items.forEach(item => productIds.add(item.productId));

        // Perform all gets
        for (const pid of productIds) {
          const pRef = doc(db, 'products', pid);
          const pDoc = await transaction.get(pRef);
          if (pDoc.exists()) {
            productDocs[pid] = pDoc.data();
          } else {
            // If it's in formData.items, it MUST exist
            if (formData.items.some(item => item.productId === pid)) {
              throw new Error(`Product not found: ${pid}`);
            }
          }
        }

        // 2. WRITES SECOND
        
        // Handle Customer (CRM)
        if (customerId && existingCustomerData) {
          const currentPoints = existingCustomerData.points || 0;
          const currentOrderCount = existingCustomerData.orderCount || 0;
          let finalPoints = currentPoints + pointsToAdd;
          let finalOrderCount = currentOrderCount;

          if (editingSale) {
            const oldSubtotal = editingSale.subtotal || editingSale.totalAmount;
            const oldPoints = Math.floor(oldSubtotal / 100000) * 30;
            finalPoints = currentPoints - oldPoints + pointsToAdd;
          } else {
            finalOrderCount = currentOrderCount + 1;
          }

          transaction.update(doc(db, 'customers', customerId), {
            orderName: formData.orderName,
            phone: englishPhone,
            address: formData.address,
            points: finalPoints,
            orderCount: finalOrderCount,
            lastOrderDate: new Date().toISOString(),
          });
        } else {
          const customerRef = doc(collection(db, 'customers'));
          customerId = customerRef.id;
          transaction.set(customerRef, {
            facebookName: formData.facebookName,
            orderName: formData.orderName,
            phone: englishPhone,
            address: formData.address,
            points: pointsToAdd,
            orderCount: 1,
            lastOrderDate: new Date().toISOString(),
            createdAt: serverTimestamp(),
          });
        }

        // Update Product Stocks
        // First revert old stocks if editing
        if (editingSale) {
          for (const item of editingSale.items) {
            if (productDocs[item.productId]) {
              const currentStock = productDocs[item.productId].stock;
              const newStock = currentStock + item.quantity;
              transaction.update(doc(db, 'products', item.productId), { stock: newStock });
              productDocs[item.productId].stock = newStock; // Update local copy for next loop
            }
          }
        }

        // Then subtract new stocks
        for (const item of formData.items) {
          if (productDocs[item.productId]) {
            const currentStock = productDocs[item.productId].stock;
            const newStock = currentStock - item.quantity;
            transaction.update(doc(db, 'products', item.productId), { stock: newStock });
            productDocs[item.productId].stock = newStock;
          }
        }

        // Add/Update Sale Record
        const saleRef = editingSale ? doc(db, 'sales', editingSale.id) : doc(collection(db, 'sales'));
        const saleData = {
          orderNumber,
          date: formData.date,
          customerId,
          customerName: formData.orderName || formData.facebookName,
          items: formData.items,
          paymentMethod: formData.paymentMethod,
          address: formData.address,
          deliveryDate: formData.deliveryDate,
          subtotal,
          deliveryFees: formData.deliveryFees,
          totalAmount,
          note: formData.note,
          updatedAt: serverTimestamp(),
        };
        
        if (!editingSale) {
          (saleData as any).createdAt = serverTimestamp();
          transaction.set(saleRef, saleData);
        } else {
          transaction.update(saleRef, saleData);
        }
      });

      // Download order note
      downloadOrderNote({
        orderNumber,
        date: formData.date,
        customerName: formData.orderName || formData.facebookName,
        items: formData.items,
        paymentMethod: formData.paymentMethod,
        address: formData.address,
        deliveryDate: formData.deliveryDate,
        subtotal,
        deliveryFees: formData.deliveryFees,
        totalAmount,
        note: formData.note
      });

      closeModal();
    } catch (err) {
      handleFirestoreError(err, editingSale ? OperationType.UPDATE : OperationType.CREATE, 'sales');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (sale: Sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    setEditingSale(sale);
    setFormData({
      facebookName: customer?.facebookName || '',
      orderName: sale.customerName,
      phone: customer?.phone || '',
      paymentMethod: sale.paymentMethod,
      address: sale.address,
      date: sale.date.split('T')[0],
      deliveryDate: sale.deliveryDate,
      deliveryFees: sale.deliveryFees || 0,
      note: sale.note || '',
      items: sale.items,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSale(null);
    setFormData({ 
      facebookName: '', 
      orderName: '', 
      phone: '', 
      paymentMethod: 'Kpay', 
      address: '', 
      date: format(new Date(), 'yyyy-MM-dd'), 
      deliveryDate: format(new Date(), 'yyyy-MM-dd'), 
      deliveryFees: 0,
      note: '',
      items: [] 
    });
  };

  const handleDelete = async (sale: Sale) => {
    try {
      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST
        const productDocs: { [id: string]: any } = {};
        for (const item of sale.items) {
          if (!productDocs[item.productId]) {
            const pRef = doc(db, 'products', item.productId);
            const pDoc = await transaction.get(pRef);
            if (pDoc.exists()) {
              productDocs[item.productId] = pDoc.data();
            }
          }
        }

        const cRef = doc(db, 'customers', sale.customerId);
        const cDoc = await transaction.get(cRef);

        // 2. WRITES SECOND
        for (const item of sale.items) {
          if (productDocs[item.productId]) {
            const currentStock = productDocs[item.productId].stock;
            const newStock = currentStock + item.quantity;
            transaction.update(doc(db, 'products', item.productId), { stock: newStock });
            productDocs[item.productId].stock = newStock; // Update local copy if same product appears twice
          }
        }

        if (cDoc.exists()) {
          const subtotal = sale.subtotal || sale.totalAmount;
          const pointsToSubtract = Math.floor(subtotal / 100000) * 30;
          const currentPoints = cDoc.data().points || 0;
          const currentOrderCount = cDoc.data().orderCount || 0;
          
          transaction.update(cRef, { 
            points: Math.max(0, currentPoints - pointsToSubtract),
            orderCount: Math.max(0, currentOrderCount - 1)
          });
        }

        transaction.delete(doc(db, 'sales', sale.id));
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'sales');
    }
  };

  const filteredSales = sales.filter(s => 
    s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedSales, requestSort, sortConfig } = useSortableData(filteredSales, { key: 'date', direction: 'desc' });

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-rose-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-rose-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders or customers..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
        >
          <Plus className="w-5 h-5" />
          New Sale
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th onClick={() => requestSort('orderNumber')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Order #{getSortIcon('orderNumber')}</div>
              </th>
              <th onClick={() => requestSort('date')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Date{getSortIcon('date')}</div>
              </th>
              <th onClick={() => requestSort('customerName')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Customer{getSortIcon('customerName')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Items</th>
              <th onClick={() => requestSort('paymentMethod')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Payment{getSortIcon('paymentMethod')}</div>
              </th>
              <th onClick={() => requestSort('deliveryDate')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Delivery{getSortIcon('deliveryDate')}</div>
              </th>
              <th onClick={() => requestSort('totalAmount')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Total{getSortIcon('totalAmount')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedSales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{sale.orderNumber}</td>
                <td className="px-6 py-4 text-slate-600 text-xs">{format(new Date(sale.date), 'MMM d, yyyy')}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900">{sale.customerName}</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{sale.address}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {sale.items.map((item, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                        {item.quantity}x {item.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                    sale.paymentMethod === 'Cash' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                  )}>
                    {sale.paymentMethod}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 text-xs">
                  {sale.deliveryDate ? format(new Date(sale.deliveryDate), 'MMM d, yyyy') : '-'}
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                  <div className="flex flex-col items-end">
                    <span>{formatMMK(sale.totalAmount)}</span>
                    {sale.deliveryFees > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal">Incl. {formatMMK(sale.deliveryFees)} Delivery Fees</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(sale);
                      }} 
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Edit Order"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ isOpen: true, sale });
                      }} 
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete Order"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="w-6 h-6" />
                {editingSale ? 'Edit Order' : 'Create New Order'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Facebook Name</label>
                      <input required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" value={formData.facebookName} onChange={e => setFormData({...formData, facebookName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Order Name</label>
                      <input className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" value={formData.orderName} onChange={e => setFormData({...formData, orderName: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Phone Number</label>
                      <input 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: myanmarToEnglishNumerals(e.target.value)})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Sales Date</label>
                      <input type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Address</label>
                    <textarea rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Payment Method</label>
                      <select className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                        {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Delivery Date</label>
                      <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" value={formData.deliveryDate} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Delivery Fees (MMK)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" 
                      value={formData.deliveryFees} 
                      onChange={e => setFormData({...formData, deliveryFees: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Note</label>
                    <textarea 
                      rows={2} 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none resize-none" 
                      placeholder="Add order notes..."
                      value={formData.note} 
                      onChange={e => setFormData({...formData, note: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" />
                    Order Items
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600">Add Product</label>
                      <div className="relative w-1/2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search..." 
                          className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddItem(e.target.value);
                          e.target.value = '';
                          setProductSearch('');
                        }
                      }}
                    >
                      <option value="">Select a product...</option>
                      {products
                        .filter(p => p.stock > 0 && (
                          p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                          (p.productCode && p.productCode.toLowerCase().includes(productSearch.toLowerCase())) ||
                          (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
                        ))
                        .map(p => {
                          const category = categories.find(c => c.id === p.categoryId);
                          const catDisplay = category ? ` [${category.name}]` : '';
                          const codeDisplay = p.productCode ? ` (${p.productCode})` : '';
                          const brandDisplay = p.brand ? ` - ${p.brand}` : '';
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name}{brandDisplay}{codeDisplay}{catDisplay} ({formatMMK(p.sellingPrice)} - {p.stock} in stock)
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 min-h-[200px] border border-slate-100">
                    {formData.items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 mt-10">
                        <ShoppingBag className="w-8 h-8 opacity-20" />
                        <p className="text-sm">No items added yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {formData.items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900">{item.name}</span>
                              <span className="text-xs text-slate-500">{formatMMK(item.price)} each</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => {
                                  const newItems = [...formData.items];
                                  if (newItems[index].quantity > 1) {
                                    newItems[index].quantity--;
                                    setFormData({...formData, items: newItems});
                                  }
                                }} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200">-</button>
                                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                <button type="button" onClick={() => {
                                  const newItems = [...formData.items];
                                  const product = products.find(p => p.id === item.productId);
                                  if (product && newItems[index].quantity < product.stock) {
                                    newItems[index].quantity++;
                                    setFormData({...formData, items: newItems});
                                  }
                                }} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200">+</button>
                              </div>
                              <button type="button" onClick={() => handleRemoveItem(item.productId)} className="text-rose-500 hover:text-rose-700">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-semibold text-rose-600">Product Sales Total:</span>
                      <span className="text-rose-600 font-bold">
                        {formatMMK(formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Delivery Fees:</span>
                      <span className="text-slate-700 font-semibold">
                        {formatMMK(formData.deliveryFees)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-bold">Total Amount (Customer Pays):</span>
                      <span className="text-2xl font-black text-slate-900">
                        {formatMMK(formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) + formData.deliveryFees)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  disabled={isSubmitting}
                  className="px-6 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-10 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    editingSale ? 'Update Order' : 'Complete Order'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Sale Order"
        message={`Are you sure you want to delete order #${deleteConfirm.sale?.orderNumber}? This will revert product stock and customer points.`}
        onConfirm={() => deleteConfirm.sale && handleDelete(deleteConfirm.sale)}
        onCancel={() => setDeleteConfirm({ isOpen: false, sale: null })}
        confirmText="Delete Order"
      />
    </div>
  );
}
