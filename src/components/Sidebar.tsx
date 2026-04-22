import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Receipt, Tags, Users, Truck, Settings, ChevronRight, Database, FileText, Heart } from 'lucide-react';
import { cn } from '../lib/utils';
import { MenuType } from '../App';

interface SidebarProps {
  activeMenu: MenuType;
  setActiveMenu: (menu: MenuType) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ activeMenu, setActiveMenu, isOpen, onClose }: SidebarProps) {
  const menuItems: { name: MenuType; icon: React.ElementType; color: string }[] = [
    { name: 'Dashboard', icon: LayoutDashboard, color: 'text-pink-600 bg-pink-50' },
    { name: 'Inventory', icon: Package, color: 'text-pink-600 bg-pink-50' },
    { name: 'ProductMaster', icon: Tags, color: 'text-rose-600 bg-rose-50' },
    { name: 'Purchase', icon: ShoppingCart, color: 'text-pink-600 bg-pink-50' },
    { name: 'Sales', icon: TrendingUp, color: 'text-rose-600 bg-rose-50' },
    { name: 'FinancialReport', icon: FileText, color: 'text-pink-600 bg-pink-50' },
    { name: 'Expense', icon: Receipt, color: 'text-pink-600 bg-pink-50' },
    { name: 'Categories', icon: Tags, color: 'text-rose-600 bg-rose-50' },
    { name: 'CRM', icon: Users, color: 'text-pink-600 bg-pink-50' },
    { name: 'Supplier', icon: Truck, color: 'text-rose-600 bg-rose-50' },
    { name: 'Backup', icon: Database, color: 'text-pink-600 bg-pink-50' },
    { name: 'Report', icon: TrendingUp, color: 'text-pink-600 bg-pink-50' },
    { name: 'Setting', icon: Settings, color: 'text-slate-600 bg-slate-50' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col h-screen z-50 transition-transform duration-300 lg:sticky lg:translate-x-0 lg:z-0 shadow-sm",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-400 rounded-xl flex items-center justify-center shadow-lg shadow-pink-100">
              <Heart className="w-6 h-6 text-white fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">FreshPOS</span>
          </div>
          <button onClick={onClose} className="p-2 lg:hidden text-slate-400 hover:text-slate-600">
             <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
        </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.name;
          return (
            <button
              key={item.name}
              onClick={() => setActiveMenu(item.name)}
              className={cn(
                "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-pink-50 text-pink-700 font-semibold shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  isActive ? item.color : "bg-transparent group-hover:bg-slate-100"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm">{item.name}</span>
              </div>
              {isActive && (
                <div className="w-1.5 h-6 bg-pink-400 rounded-full absolute left-0" />
              )}
              <ChevronRight className={cn(
                "w-4 h-4 opacity-0 transition-all",
                isActive ? "opacity-100 translate-x-0" : "group-hover:opacity-40 -translate-x-2"
              )} />
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <div className="bg-pink-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-pink-600 uppercase tracking-wider mb-1">Support</p>
          <p className="text-xs text-pink-900/60 leading-relaxed">Need help? Contact our support team for assistance.</p>
        </div>
      </div>
    </aside>
  </>
  );
}
