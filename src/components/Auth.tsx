import React from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, LogOut, User } from 'lucide-react';

export function Auth() {
  const [user, setUser] = React.useState(auth.currentUser);

  React.useEffect(() => {
    return auth.onAuthStateChanged((u) => setUser(u));
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <LogIn className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">GlowProfit</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">Supplement & Skin Care ERP. Manage your inventory, sales, and CRM in one place.</p>
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-3">
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-600" />
          </div>
        )}
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-slate-900 leading-none mb-1">{user.displayName}</p>
          <p className="text-xs text-slate-500 leading-none">{user.email}</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        title="Sign out"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
}
