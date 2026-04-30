import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, runTransaction, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Plus, TrendingUp, User, ShoppingBag, MapPin, CreditCard, Calendar, Trash2, Search, Edit2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import { cn, handleFirestoreError, OperationType, formatMMK, myanmarToEnglishNumerals, useSortableData } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from './ConfirmModal';
import * as XLSX from 'xlsx';

interface Sale {
  id: string;
  order_no: string;
  date: string;
  customer_id: string;
  customerName: string;
  items: { product_id: string; name: string; qty: number; sold_price_snapshot: number; cost_price_snapshot: number }[];
  paymentMethod: string;
  payment_status: 'Paid' | 'Unpaid' | 'Partial';
  address: string;
  deliveryDate: string;
  subtotal: number;
  gross_amount: number;
  tax_amount: number;
  net_amount: number;
  deliveryFees: number;
  total_amount: number;
  profit?: number;
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
  total_stock: number;
  average_cost_price: number;
  current_selling_price: number;
  categoryId: string;
}

interface MasterProduct {
  id: string;
  name: string;
  productCode: string;
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

import { notifyUndo } from '../lib/notifications';

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
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
    payment_status: 'Paid' as const,
    address: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    deliveryDate: format(new Date(), 'yyyy-MM-dd'),
    deliveryFees: 0,
    tax_amount: 0,
    note: '',
    items: [] as { product_id: string; name: string; qty: number; sold_price_snapshot: number; cost_price_snapshot: number }[],
  });
  const [productSearch, setProductSearch] = useState('');

  const paymentMethods = ['Kpay', 'WavePay', 'AYAPay', 'uabpay', 'Bank', 'Cash', 'Credit', 'COD (Cash on Deli)'];

  useEffect(() => {
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          total_amount: Number(data.total_amount || data.totalAmount || 0),
          subtotal: Number(data.subtotal || 0),
          gross_amount: Number(data.gross_amount || data.subtotal || 0),
          order_no: data.order_no || data.orderNumber
        } as Sale;
      }));
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

    const unsubMaster = onSnapshot(collection(db, 'productMaster'), (snapshot) => {
      setMasterProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterProduct)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'productMaster'));

    return () => {
      unsubSales();
      unsubProducts();
      unsubCustomers();
      unsubCategories();
      unsubMaster();
    };
  }, []);

  const getProductStockLimit = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const originalItem = editingSale?.items.find(i => (i.product_id || (i as any).productId) === productId);
    const originalQty = Number(originalItem?.qty || 0);
    return Number(product.total_stock || 0) + originalQty;
  };

  const handleAddItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const limit = getProductStockLimit(productId);
    const existingItem = formData.items.find(item => item.product_id === productId);
    if (existingItem) {
      if (existingItem.qty >= limit) {
        alert(`Only ${limit} units of "${product.name}" are available in stock.`);
        return;
      }
      setFormData({
        ...formData,
        items: formData.items.map(item => 
          item.product_id === productId ? { ...item, qty: item.qty + 1 } : item
        )
      });
    } else {
      if (limit <= 0) {
        alert(`"${product.name}" is out of stock.`);
        return;
      }
      setFormData({
        ...formData,
        items: [...formData.items, { product_id: productId, name: product.name, qty: 1, sold_price_snapshot: product.current_selling_price, cost_price_snapshot: product.average_cost_price }]
      });
    }
  };

  const handleRemoveItem = (productId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.product_id !== productId)
    });
  };

  const generateOrderNumber = async (dateStr: string) => {
    const saleDate = new Date(dateStr);
    const mm = String(saleDate.getMonth() + 1).padStart(2, '0');
    const yy = String(saleDate.getFullYear()).slice(-2);
    const prefix = `${mm}${yy}`;
    
    const monthSales = sales.filter(s => s.order_no?.startsWith(prefix));
    const nextNum = String(monthSales.length + 1).padStart(4, '0');
    return `${prefix}${nextNum}`;
  };

  const downloadOrderNote = (saleData: any) => {
    const itemsText = saleData.items.map((item: any) => `- ${item.name} x ${item.qty} (${formatMMK(item.sold_price_snapshot)})`).join('\n');
    const noteText = saleData.note ? `\nNOTE:\n${saleData.note}\n` : '';
    const note = `
ORDER NOTE
-----------
Order Number: ${saleData.order_no}
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
TOTAL AMOUNT: ${formatMMK(saleData.total_amount)}
-----------
Thank you for your order!
    `.trim();

    const blob = new Blob([note], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Order_${saleData.order_no}.txt`;
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
      const gross_amount = Number((formData.items || []).reduce((sum, item) => sum + (item.sold_price_snapshot * item.qty), 0));
      const subtotal = gross_amount;
      const tax_amount = Number(formData.tax_amount || 0);
      const deliveryFees = Number(formData.deliveryFees || 0);
      const net_amount = gross_amount + tax_amount + deliveryFees;
      const totalAmount = net_amount;
      
      const pointsToAdd = Math.floor(subtotal / 100000) * 30;
      const orderNumber = editingSale ? editingSale.order_no : await generateOrderNumber(formData.date);
      const englishPhone = myanmarToEnglishNumerals(formData.phone || '');

      // 1. Handle Customer (CRM) - Query outside transaction
      let customer_id = '';
      const trimFacebookName = (formData.facebookName || '').trim();
      if (!trimFacebookName) throw new Error('Facebook name is required');

      const customerQuery = query(collection(db, 'customers'), where('facebookName', '==', trimFacebookName));
      const customerSnap = await getDocs(customerQuery);
      
      if (!customerSnap.empty) {
        const customerDoc = customerSnap.docs[0];
        customer_id = customerDoc.id;
      }

      await runTransaction(db, async (transaction) => {
        // --- 1. READS SECTION ---
        const productDocs: { [id: string]: any } = {};
        const productIds = new Set<string>();
        if (editingSale && editingSale.items) {
          editingSale.items.forEach(item => {
            const pid = item.product_id || (item as any).productId;
            if (pid) productIds.add(pid);
          });
        }
        (formData.items || []).forEach(item => {
          const pid = item.product_id || (item as any).productId;
          if (pid) productIds.add(pid);
        });

        for (const pid of productIds) {
          if (!pid) continue;
          const pRef = doc(db, 'products', pid);
          const pDoc = await transaction.get(pRef);
          if (pDoc.exists()) {
            productDocs[pid] = pDoc.data();
          } else if (formData.items.some(item => item.product_id === pid)) {
            throw new Error(`Product not found: ${pid}`);
          }
        }

        // Read customer info for BOTH old and new customer if they changed
        let newCustomerDoc = null;
        let oldCustomerDoc = null;

        if (customer_id) {
          newCustomerDoc = await transaction.get(doc(db, 'customers', customer_id));
        }
        
        if (editingSale && editingSale.customer_id && editingSale.customer_id !== customer_id) {
          oldCustomerDoc = await transaction.get(doc(db, 'customers', editingSale.customer_id));
        }

        // --- 2. WRITES SECTION ---
        
        // Handle Customer (CRM) - Points and counts
        if (editingSale && editingSale.customer_id && editingSale.customer_id !== customer_id) {
          // Customer changed: Revert old customer points
          if (oldCustomerDoc?.exists()) {
            const oldData = oldCustomerDoc.data();
            const oldSubtotal = editingSale.subtotal || editingSale.total_amount;
            const oldPoints = Math.floor(oldSubtotal / 100000) * 30;
            transaction.update(doc(db, 'customers', editingSale.customer_id), {
              points: Math.max(0, (oldData.points || 0) - oldPoints),
              orderCount: Math.max(0, (oldData.orderCount || 0) - 1)
            });
          }

          // New customer added points/count
          if (customer_id && newCustomerDoc?.exists()) {
            const newData = newCustomerDoc.data();
            transaction.update(doc(db, 'customers', customer_id), {
              points: (newData.points || 0) + pointsToAdd,
              orderCount: (newData.orderCount || 0) + 1,
              facebookName: trimFacebookName,
              orderName: formData.orderName,
              phone: englishPhone,
              address: formData.address,
              lastOrderDate: new Date().toISOString(),
            });
          } else {
            const customerRef = doc(collection(db, 'customers'));
            customer_id = customerRef.id;
            transaction.set(customerRef, {
              facebookName: trimFacebookName,
              orderName: formData.orderName,
              phone: englishPhone,
              address: formData.address,
              points: pointsToAdd,
              orderCount: 1,
              lastOrderDate: new Date().toISOString(),
              createdAt: serverTimestamp(),
            });
          }
        } else {
          // Same customer or new sale
          if (customer_id && newCustomerDoc?.exists()) {
            const currentData = newCustomerDoc.data();
            const currentPoints = currentData.points || 0;
            const currentOrderCount = currentData.orderCount || 0;
            let finalPoints = currentPoints + pointsToAdd;
            let finalOrderCount = currentOrderCount;

            if (editingSale) {
              const oldSubtotal = editingSale.subtotal || editingSale.total_amount;
              const oldPoints = Math.floor(oldSubtotal / 100000) * 30;
              finalPoints = Math.max(0, currentPoints - oldPoints + pointsToAdd);
            } else {
              finalOrderCount = currentOrderCount + 1;
            }

            transaction.update(doc(db, 'customers', customer_id), {
              orderName: formData.orderName,
              phone: englishPhone,
              address: formData.address,
              points: finalPoints,
              orderCount: finalOrderCount,
              lastOrderDate: new Date().toISOString(),
            });
          } else {
            const customerRef = doc(collection(db, 'customers'));
            customer_id = customerRef.id;
            transaction.set(customerRef, {
              facebookName: trimFacebookName,
              orderName: formData.orderName,
              phone: englishPhone,
              address: formData.address,
              points: pointsToAdd,
              orderCount: 1,
              lastOrderDate: new Date().toISOString(),
              createdAt: serverTimestamp(),
            });
          }
        }

        // Update Product Stocks
        if (editingSale && editingSale.items) {
          for (const item of editingSale.items) {
            const pid = item.product_id || (item as any).productId;
            if (pid && productDocs[pid]) {
              const currentStock = productDocs[pid].total_stock || 0;
              const newStock = currentStock + item.qty;
              transaction.update(doc(db, 'products', pid), { total_stock: newStock });
              productDocs[pid].total_stock = newStock;
            }
          }
        }

        // Add/Update Sale Record
        const saleRef = (editingSale && editingSale.id) 
          ? doc(db, 'sales', editingSale.id) 
          : doc(collection(db, 'sales'));

        // Subtract new stocks
        for (const item of formData.items) {
          const pid = item.product_id || (item as any).productId;
          if (pid && productDocs[pid]) {
            const currentStock = productDocs[pid].total_stock || 0;
            const newStock = currentStock - item.qty;
            transaction.update(doc(db, 'products', pid), { total_stock: newStock });
            
            // Record Inventory Log
            const logRef = doc(collection(db, 'inventory_logs'));
            transaction.set(logRef, {
              product_id: pid,
              productName: item.name || 'Unknown',
              type: 'OUT',
              qty: item.qty,
              referenceId: saleRef.id,
              reason: editingSale ? 'Sale Updated' : 'Sale Created',
              date: serverTimestamp(),
              previousQty: currentStock,
              newQty: newStock,
            });

            productDocs[pid].total_stock = newStock;
          }
        }

        // Calculate Profit from snapshotted costs
        let totalProfit = 0;
        formData.items.forEach(item => {
          const itemProfit = (item.sold_price_snapshot - item.cost_price_snapshot) * item.qty;
          totalProfit += itemProfit;
        });

        const saleData = {
          order_no: orderNumber || 'PENDING',
          date: formData.date || new Date().toISOString().split('T')[0],
          customer_id: customer_id || '',
          customerName: formData.orderName || formData.facebookName || 'Unknown',
          items: (formData.items || []).map(item => ({
            product_id: item.product_id || (item as any).productId || '',
            name: item.name || 'Unknown',
            qty: Number(item.qty || 0),
            sold_price_snapshot: Number(item.sold_price_snapshot || 0),
            cost_price_snapshot: Number(item.cost_price_snapshot || 0)
          })),
          paymentMethod: formData.paymentMethod || 'Kpay',
          payment_status: formData.payment_status || 'Paid',
          address: formData.address || '',
          deliveryDate: formData.deliveryDate || '',
          subtotal: Number(subtotal || 0),
          gross_amount: Number(gross_amount || 0),
          tax_amount: Number(tax_amount || 0),
          net_amount: Number(net_amount || 0),
          deliveryFees: Number(formData.deliveryFees || 0),
          total_amount: Number(totalAmount || 0),
          profit: isNaN(totalProfit) ? 0 : Number(totalProfit),
          note: formData.note || '',
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
        order_no: orderNumber,
        date: formData.date,
        customerName: formData.orderName || formData.facebookName,
        items: formData.items,
        paymentMethod: formData.paymentMethod,
        address: formData.address,
        deliveryDate: formData.deliveryDate,
        subtotal,
        deliveryFees: formData.deliveryFees,
        total_amount: totalAmount,
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
    if (!sale) return;
    const customer = customers.find(c => c.id === (sale.customer_id || (sale as any).customerId));
    setEditingSale(sale);
    setFormData({
      facebookName: customer?.facebookName || (sale as any).facebookName || (sale as any).customerName || '',
      orderName: sale.customerName || '',
      phone: customer?.phone || (sale as any).phone || '',
      paymentMethod: sale.paymentMethod || 'Kpay',
      payment_status: sale.payment_status || 'Paid',
      address: sale.address || customer?.address || '',
      date: (sale.date || '').split('T')[0] || format(new Date(), 'yyyy-MM-dd'),
      deliveryDate: (sale.deliveryDate || '').split('T')[0] || '',
      deliveryFees: Number(sale.deliveryFees || 0),
      tax_amount: Number(sale.tax_amount || 0),
      note: sale.note || '',
      items: (sale.items || []).map(item => ({
        product_id: item.product_id || (item as any).productId || '',
        name: item.name || 'Unknown',
        qty: Number(item.qty || 0),
        sold_price_snapshot: Number(item.sold_price_snapshot || 0),
        cost_price_snapshot: Number(item.cost_price_snapshot || 0)
      })),
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
      payment_status: 'Paid',
      address: '', 
      date: format(new Date(), 'yyyy-MM-dd'), 
      deliveryDate: format(new Date(), 'yyyy-MM-dd'), 
      deliveryFees: 0,
      tax_amount: 0,
      note: '',
      items: [] 
    });
  };

  const handleDelete = async (sale: Sale) => {
    try {
      await runTransaction(db, async (transaction) => {
        // --- 1. READS SECTION ---
        const productDocs: { [id: string]: any } = {};
        for (const item of (sale.items || [])) {
          const pid = item.product_id || (item as any).productId;
          if (pid && !productDocs[pid]) {
            const pRef = doc(db, 'products', pid);
            const pDoc = await transaction.get(pRef);
            if (pDoc.exists()) {
              productDocs[pid] = pDoc.data();
            }
          }
        }

        const cid = sale.customer_id || (sale as any).customerId;
        const cDoc = cid ? await transaction.get(doc(db, 'customers', cid)) : null;

        // --- 2. WRITES SECTION ---
        for (const item of (sale.items || [])) {
          const pid = item.product_id || (item as any).productId;
          if (pid && productDocs[pid]) {
            const currentStock = productDocs[pid].total_stock || 0;
            const newStock = currentStock + item.qty;
            transaction.update(doc(db, 'products', pid), { total_stock: newStock });
            productDocs[pid].total_stock = newStock;
          }
        }

        if (cDoc?.exists()) {
          const subtotal = sale.subtotal || sale.total_amount;
          const pointsToSubtract = Math.floor(subtotal / 100000) * 30;
          const currentData = cDoc.data();
          const currentPoints = currentData.points || 0;
          const currentOrderCount = currentData.orderCount || 0;
          
          transaction.update(cDoc.ref, { 
            points: Math.max(0, currentPoints - pointsToSubtract),
            orderCount: Math.max(0, currentOrderCount - 1)
          });
        }

        if (sale.id) {
          transaction.delete(doc(db, 'sales', sale.id));

          // Log the return to inventory
          (sale.items || []).forEach(item => {
            const pid = item.product_id || (item as any).productId;
            if (pid) {
              const logRef = doc(collection(db, 'inventory_logs'));
              transaction.set(logRef, {
                product_id: pid,
                productName: item.name || 'Unknown',
                type: 'IN',
                qty: item.qty,
                referenceId: sale.id,
                reason: 'Sale Deleted (Stock Returned)',
                date: serverTimestamp(),
              });
            }
          });
        }
      });

      notifyUndo({
        message: `Order #${sale.order_no} deleted`,
        undo: async () => {
          await runTransaction(db, async (transaction) => {
            // --- 1. READS SECTION ---
            const productDocs: { [id: string]: any } = {};
            for (const item of (sale.items || [])) {
              const pid = item.product_id || (item as any).productId;
              if (pid && !productDocs[pid]) {
                const pRef = doc(db, 'products', pid);
                const pDoc = await transaction.get(pRef);
                if (pDoc.exists()) {
                  productDocs[pid] = pDoc.data();
                }
              }
            }

            const cid = sale.customer_id || (sale as any).customerId;
            const cDoc = cid ? await transaction.get(doc(db, 'customers', cid)) : null;

            // --- 2. WRITES SECTION ---
            for (const item of (sale.items || [])) {
              const pid = item.product_id || (item as any).productId;
              if (pid && productDocs[pid]) {
                const pRef = doc(db, 'products', pid);
                transaction.update(pRef, { 
                  total_stock: (productDocs[pid].total_stock || 0) - item.qty 
                });
              }
            }

            if (cDoc?.exists()) {
              const subtotal = sale.subtotal || sale.total_amount;
              const pointsToAdd = Math.floor(subtotal / 100000) * 30;
              const currentData = cDoc.data();
              transaction.update(cDoc.ref, { 
                points: (currentData.points || 0) + pointsToAdd,
                orderCount: (currentData.orderCount || 0) + 1
              });
            }

            if (sale.id) {
              const { id, ...data } = sale;
              transaction.set(doc(db, 'sales', id), {
                ...data,
                updatedAt: serverTimestamp(),
                isUndone: true
              });
            }
          });
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'sales');
    }
  };

  const filteredSales = sales.filter(s => 
    (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.order_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedSales, requestSort, sortConfig } = useSortableData(filteredSales, { key: 'date', direction: 'desc' });

  const exportToExcel = () => {
    const data = sortedSales.map(s => ({
      'Order #': s.order_no,
      'Date': s.date,
      'Customer': s.customerName,
      'Items': s.items.map(i => `${i.name} x${i.qty}`).join(', '),
      'Payment': s.paymentMethod,
      'Status': s.payment_status,
      'Gross Amount': s.gross_amount || s.subtotal,
      'Tax': s.tax_amount || 0,
      'Delivery': s.deliveryFees,
      'Net Total': s.net_amount || s.total_amount,
      'Address': s.address,
      'Note': s.note || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `sales_export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 text-pink-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-pink-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders or customers..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 group"
          >
            <FileSpreadsheet className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl font-semibold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100"
          >
            <Plus className="w-5 h-5" />
            New Sale
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th onClick={() => requestSort('order_no')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Order #{getSortIcon('order_no')}</div>
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
              <th onClick={() => requestSort('payment_status')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Status{getSortIcon('payment_status')}</div>
              </th>
              <th onClick={() => requestSort('deliveryDate')} className="px-6 py-4 text-sm font-semibold text-slate-600 cursor-pointer group">
                <div className="flex items-center">Delivery{getSortIcon('deliveryDate')}</div>
              </th>
              <th onClick={() => requestSort('subtotal')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Sold Price{getSortIcon('subtotal')}</div>
              </th>
              <th onClick={() => requestSort('total_amount')} className="px-6 py-4 text-sm font-semibold text-slate-600 text-right cursor-pointer group">
                <div className="flex items-center justify-end">Total{getSortIcon('total_amount')}</div>
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedSales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{sale.order_no}</td>
                <td className="px-6 py-4 text-slate-600 text-xs">{format(new Date(sale.date), 'MMM d, yyyy')}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900">{sale.customerName}</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{sale.address}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {sale.items.map((item, i) => {
                      const master = masterProducts.find(m => m.name.toLowerCase() === item.name.toLowerCase());
                      const code = master?.productCode || '';
                      return (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                          {item.qty}x {item.name}{code && ` (${code})`}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                    sale.paymentMethod === 'Cash' ? "bg-emerald-50 text-emerald-700" : "bg-pink-50 text-pink-700"
                  )}>
                    {sale.paymentMethod}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                    sale.payment_status === 'Paid' ? "bg-emerald-50 text-emerald-700" : 
                    sale.payment_status === 'Partial' ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                  )}>
                    {sale.payment_status || 'Paid'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 text-xs">
                  {sale.deliveryDate ? format(new Date(sale.deliveryDate), 'MMM d, yyyy') : '-'}
                </td>
                <td className="px-6 py-4 text-right font-medium text-slate-600">
                  {formatMMK(sale.gross_amount || sale.subtotal)}
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                  <div className="flex flex-col items-end">
                    <span>{formatMMK(sale.total_amount)}</span>
                    {(sale.deliveryFees > 0 || sale.tax_amount > 0) && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        Incl. {sale.deliveryFees > 0 ? `${formatMMK(sale.deliveryFees)} Deli` : ''} 
                        {sale.deliveryFees > 0 && sale.tax_amount > 0 ? ' + ' : ''}
                        {sale.tax_amount > 0 ? `${formatMMK(sale.tax_amount)} Tax` : ''}
                      </span>
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
                      className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
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
                      className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
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
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-pink-600 text-white">
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
                      <input required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.facebookName || ''} onChange={e => setFormData({...formData, facebookName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Order Name</label>
                      <input className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.orderName || ''} onChange={e => setFormData({...formData, orderName: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Phone Number</label>
                      <input 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                        value={formData.phone || ''} 
                        onChange={e => setFormData({...formData, phone: myanmarToEnglishNumerals(e.target.value)})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Sales Date</label>
                      <input type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Address</label>
                    <textarea rows={2} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Payment Method</label>
                      <select className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.paymentMethod || 'Kpay'} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                        {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Payment Status</label>
                      <select className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.payment_status || 'Paid'} onChange={e => setFormData({...formData, payment_status: e.target.value as any})}>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Partial">Partial</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Delivery Date</label>
                      <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" value={formData.deliveryDate || ''} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Delivery Fees (MMK)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                        value={formData.deliveryFees || 0} 
                        onChange={e => setFormData({...formData, deliveryFees: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Tax Amount (MMK)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none" 
                        value={formData.tax_amount || 0} 
                        onChange={e => setFormData({...formData, tax_amount: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Note</label>
                    <textarea 
                      rows={2} 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none resize-none" 
                      placeholder="Add order notes..."
                      value={formData.note || ''} 
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
                          className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-pink-500 outline-none"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
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
                        .filter(p => {
                          const limit = getProductStockLimit(p.id);
                          return limit > 0 && (
                            p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                            (p.productCode && p.productCode.toLowerCase().includes(productSearch.toLowerCase())) ||
                            (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
                          );
                        })
                        .map(p => {
                          const category = categories.find(c => c.id === p.categoryId);
                          const catDisplay = category ? ` [${category.name}]` : '';
                          const codeDisplay = p.productCode ? ` (${p.productCode})` : '';
                          const brandDisplay = p.brand ? ` - ${p.brand}` : '';
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name}{brandDisplay}{codeDisplay}{catDisplay} ({formatMMK(p.current_selling_price)} - {p.total_stock} in stock)
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
                              <span className="text-xs text-slate-500">{formatMMK(item.sold_price_snapshot)} each</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => {
                                  const newItems = [...formData.items];
                                  if (newItems[index].qty > 1) {
                                    newItems[index].qty--;
                                    setFormData({...formData, items: newItems});
                                  }
                                }} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200">-</button>
                                <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                                <button type="button" onClick={() => {
                                  const newItems = [...formData.items];
                                  const limit = getProductStockLimit(item.product_id);
                                  if (newItems[index].qty < limit) {
                                    newItems[index].qty++;
                                    setFormData({...formData, items: newItems});
                                  } else {
                                    alert(`Only ${limit} units are available.`);
                                  }
                                }} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-slate-200">+</button>
                              </div>
                              <button type="button" onClick={() => handleRemoveItem(item.product_id)} className="text-pink-500 hover:text-pink-700">
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
                      <span className="text-slate-500 font-semibold text-pink-600">Total Sold Price:</span>
                      <span className="text-pink-600 font-bold">
                        {formatMMK(formData.items.reduce((sum, item) => sum + (item.sold_price_snapshot * item.qty), 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Tax Amount:</span>
                      <span className="text-slate-700 font-semibold">
                        {formatMMK(formData.tax_amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Delivery Fees:</span>
                      <span className="text-slate-700 font-semibold">
                        {formatMMK(formData.deliveryFees)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-slate-200">
                      <span className="text-lg font-black text-slate-900">Total Amount:</span>
                      <span className="text-3xl font-black text-rose-600">
                        {formatMMK(
                          formData.items.reduce((sum, item) => sum + (item.sold_price_snapshot * item.qty), 0) + 
                          formData.tax_amount + 
                          formData.deliveryFees
                        )}
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
        message={`Are you sure you want to delete order #${deleteConfirm.sale?.order_no}? This will revert product stock and customer points.`}
        onConfirm={() => deleteConfirm.sale && handleDelete(deleteConfirm.sale)}
        onCancel={() => setDeleteConfirm({ isOpen: false, sale: null })}
        confirmText="Delete Order"
      />
    </div>
  );
}
