import React from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { MessageSquare, Send, Bot, Sparkles, TrendingUp, AlertCircle, Loader2, Minimize2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { formatMMK, cn } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export function AIStrategist() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: 'model',
      text: "Mingalaba! I'm your FreshPOS Business Strategist. I can help you analyze your sales, find slow-moving products, and suggest marketing ideas for Facebook and TikTok. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  
  const [products, setProducts] = React.useState<any[]>([]);
  const [sales, setSales] = React.useState<any[]>([]);
  
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  React.useEffect(() => {
    if (!db) return;
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSales = onSnapshot(query(collection(db, 'sales'), orderBy('date', 'desc'), limit(50)), (snap) => {
      setSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, []);

  const getSystemContext = () => {
    const totalInventory = products.length;
    const lowStock = products.filter(p => p.total_stock < 5).map(p => `${p.name} (${p.total_stock} left)`);
    
    const salesSummary = sales.reduce((acc: any, sale: any) => {
      sale.items?.forEach((item: any) => {
        acc[item.name] = (acc[item.name] || 0) + item.qty;
      });
      return acc;
    }, {});
    
    const topProducts = Object.entries(salesSummary)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5)
      .map(([name, qty]) => `${name} (${qty} sold)`);

    const slowProducts = products
      .filter(p => !salesSummary[p.name] && p.total_stock > 10)
      .slice(0, 5)
      .map(p => `${p.name} (${p.total_stock} in stock, 0 recent sales)`);

    return `
      Current Business Context (FreshPOS Myanmar):
      - Total Products: ${totalInventory}
      - Top Selling Recent (Last 50 sales): ${topProducts.join(', ') || 'No data yet'}
      - Slow-moving/Dead Stock: ${slowProducts.join(', ') || 'None identified'}
      - Low Stock Alerts: ${lowStock.join(', ') || 'None'}
      
      Instructions:
      - You are 'FreshPOS Business Strategist', an expert AI advisor for skin care and supplement shops in Myanmar.
      - Use the context above to provide specific, data-driven advice.
      - If asked about FB/TikTok, provide content ideas (e.g. Hooks, Video styles) tailored for these platforms in the Myanmar market.
      - Keep responses professional but friendly (Mingalaba style).
      - Use formatMMK (Kyat) concepts when talking about money.
    `;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsgText = input;
    const userMessage: Message = {
      role: 'user',
      text: userMsgText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const context = getSystemContext();
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: context,
        },
        contents: [
          ...messages.map(m => ({ 
            role: m.role, 
            parts: [{ text: m.text }] 
          })),
          { role: 'user', parts: [{ text: userMsgText }] }
        ]
      });

      const responseText = response.text || "I'm sorry, I couldn't generate a strategy right now. Please try again.";
      
      setMessages(prev => [...prev, {
        role: 'model',
        text: responseText,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "I encountered an error while analyzing your data. Please check your connection and try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 bg-pink-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group overflow-hidden",
          isOpen && "hidden"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-pink-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        <MessageSquare className="w-6 h-6 relative z-10" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-pulse border-2 border-white" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-2rem)] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50"
          >
          <div className="p-4 bg-gradient-to-r from-pink-600 to-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold">AI Strategist</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[10px] font-medium text-pink-100 uppercase tracking-wider">Business Advisor</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setInput("How are my sales performing?")} className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 hover:border-pink-300 hover:text-pink-600 transition-all flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Sales Analysis
            </button>
            <button onClick={() => setInput("Suggest content for Facebook/TikTok to sell slow products")} className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 hover:border-pink-300 hover:text-pink-600 transition-all flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Content Ideas
            </button>
            <button onClick={() => setInput("Show low stock alerts and what to reorder")} className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 hover:border-pink-300 hover:text-pink-600 transition-all flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" /> Stock Advice
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col max-w-[85%]", m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                <div className={cn("p-3 rounded-2xl text-sm shadow-sm", m.role === 'user' ? "bg-pink-600 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-800 rounded-tl-none")}>
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {format(m.timestamp, 'p')}
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center animate-spin">
                  <Loader2 className="w-4 h-4 text-pink-500" />
                </div>
                <span className="text-xs font-medium animate-pulse">Analyzing business data...</span>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask for business advice..."
                className="flex-1 pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-pink-500 outline-none transition-all text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-3">
              AI can make mistakes. Please verify important strategy decisions.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);
}
