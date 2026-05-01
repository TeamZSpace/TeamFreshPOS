import React from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { MessageSquare, Send, Bot, Sparkles, TrendingUp, AlertCircle, Loader2, Minimize2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { formatMMK, cn } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

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
      text: "မင်္ဂလာပါ! ကျွန်တော်က FreshPOS ရဲ့ Business Strategist AI ပါ။ အရောင်းစာရင်းတွေကို analyze လုပ်ပေးတာ၊ ရောင်းအားနှေးတဲ့ product တွေကို ရှာဖွေပေးတာနဲ့ Facebook/TikTok မှာ ဘယ်လို content မျိုးနဲ့ ရောင်းသင့်လဲဆိုတဲ့ အကြံဉာဏ်တွေကို ပေးနိုင်ပါတယ်။ ဘာများ ကူညီပေးရမလဲခင်ဗျာ?",
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
      - You MUST correspond in Myanmar language (Burmese) using the Burmese script.
      - Use the context above to provide specific, data-driven advice.
      - Use Markdown for your responses. Specifically, use bullet points (*) or numbered lists for suggestions, content ideas, and product lists.
      - If asked about FB/TikTok, provide content ideas (e.g. Hooks, Video styles) tailored for these platforms in the Myanmar market.
      - Provide video titles, captions, and script ideas in Burmese.
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
      const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const context = getSystemContext();
      
      // Filter messages to ensure we start with a user message for current Gemini model requirements
      const apiHistory = messages
        .filter((m, idx) => m.role === 'user' || idx > 0) // Keep model greeting but ensure sequence makes sense
        .map(m => ({ 
          role: m.role, 
          parts: [{ text: m.text }] 
        }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: context,
        },
        contents: [
          ...apiHistory,
          { role: 'user', parts: [{ text: userMsgText }] }
        ]
      });

      const responseText = response.text || "တောင်းပန်ပါတယ်၊ အခုလောလောဆယ် အကြံဉာဏ်မပေးနိုင်သေးပါဘူး။ နောက်မှ ပြန်ကြိုးစားကြည့်ပေးပါ။";
      
      setMessages(prev => [...prev, {
        role: 'model',
        text: responseText,
        timestamp: new Date()
      }]);
    } catch (error: any) {
      console.error('AI Error:', error);
      const errorMsg = error?.message?.includes("GEMINI_API_KEY") 
        ? "AI key မရှိပါ။ ကျေးဇူးပြု၍ Settings တွင် check လုပ်ပေးပါ။"
        : `အမှားတစ်ခု ဖြစ်ပေါ်နေပါတယ်: ${error?.message || "connection error"}. ကျေးဇူးပြု၍ ပြန်ကြိုးစားကြည့်ပေးပါ။`;
      
      setMessages(prev => [...prev, {
        role: 'model',
        text: errorMsg,
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
            <button onClick={() => setInput("အရောင်းစာရင်းတွေကို စစ်ဆေးပေးပါ")} className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600 hover:border-pink-300 hover:text-pink-600 transition-all flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> အရောင်းစစ်ဆေးရန်
            </button>
            <button onClick={() => setInput("ရောင်းအားနှေးတဲ့ ပစ္စည်းတွေအတွက် FB/TikTok content အကြံပေးပါ")} className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600 hover:border-pink-300 hover:text-pink-600 transition-all flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Content အကြံဉာဏ်
            </button>
            <button onClick={() => setInput("ပစ္စည်းလက်ကျန်နည်းနေတာတွေ ရှိလား?")} className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600 hover:border-pink-300 hover:text-pink-600 transition-all flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" /> လက်ကျန်စစ်ရန်
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col max-w-[85%]", m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                <div className={cn("p-3 rounded-2xl text-sm shadow-sm", m.role === 'user' ? "bg-pink-600 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-800 rounded-tl-none")}>
                  {m.role === 'user' ? (
                    m.text
                  ) : (
                    <div className="prose prose-sm prose-pink max-w-none prose-p:leading-relaxed prose-li:my-1 prose-ul:my-2 prose-ol:my-2">
                       <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  )}
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
                <span className="text-xs font-medium animate-pulse">အချက်အလက်များကို စစ်ဆေးနေပါသည်...</span>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="relative flex items-center gap-2">
              <input
                type="text"
                placeholder="အကြံဉာဏ် တောင်းဆိုပါ..."
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
              AI သည် မှားယွင်းတတ်သဖြင့် အရေးကြီးသော ဆုံးဖြတ်ချက်များကို ပြန်လည်စစ်ဆေးပါ။
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);
}
