import React from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, LogOut, User } from 'lucide-react';

export function Auth() {
  const [user, setUser] = React.useState(auth.currentUser);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    return auth.onAuthStateChanged((u) => setUser(u));
  }, []);

  const login = async () => {
    setError(null);
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login failed:', error);
      let message = 'Sign in failed. Please try again.';
      if (error.code === 'auth/popup-blocked') {
        message = 'The sign-in popup was blocked by your browser. Please allow popups for this site.';
      } else if (error.code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorized for sign-in. Please add the current domain to your Firebase Console (Authentication > Settings > Authorized domains).';
      } else if (error.code === 'auth/operation-not-allowed') {
        message = 'Google sign-in is not enabled in your Firebase Console. Please enable it under Authentication > Sign-in method.';
      } else if (error.message) {
        message = error.message;
      }
      setError(message);
    } finally {
      setIsLoading(false);
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
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-left">
              <p className="font-bold mb-1">Sign-in Error:</p>
              <p className="mb-2">{error}</p>
              <div className="mt-4 pt-4 border-t border-red-200">
                <p className="font-bold text-xs uppercase mb-2">Debug Info for Firebase Console:</p>
                <p className="text-xs mb-1">Current Domain to Authorize:</p>
                <code className="block p-2 bg-white rounded border border-red-100 font-mono text-[10px] break-all select-all">
                  {window.location.hostname}
                </code>
                <p className="text-[10px] mt-2 opacity-80 italic">
                  Copy the domain above and add it to <b>Authentication &gt; Settings &gt; Authorized domains</b> in your Firebase Console.
                </p>
              </div>
              <p className="text-xs mt-4 opacity-80">Tip: If you are using this app inside an iframe, try opening it in a new tab.</p>
            </div>
          )}

          <button
            onClick={login}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <LogIn className="w-5 h-5" />
            )}
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
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
