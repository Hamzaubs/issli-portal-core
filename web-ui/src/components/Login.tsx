// web-ui/src/components/Login.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { ArrowRight, Ship, AlertCircle } from 'lucide-react';

export type PortalMode = 'ADMIN' | 'LEGAL' | 'POS';
interface LoginProps {
  portal: PortalMode;
  onLogin: (data: { user: any, token: string, portal: PortalMode }) => void;
}

export const Login: React.FC<LoginProps> = ({ portal, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ BRANDING: Professional French Theme Configuration
  const styleConfig: Record<PortalMode, any> = {
    POS: {
      theme: 'emerald',
      title: 'Espace Magasin',
      sub: 'Point de Vente & Stock Interne',
      iconBg: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/50 shadow-emerald-500/20',
      subText: 'text-emerald-400',
      button: 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-900/20',
      focus: 'focus:border-emerald-500'
    },
    LEGAL: {
      theme: 'blue',
      title: 'Espace Légal',
      sub: 'Comptabilité & Facturation',
      iconBg: 'bg-blue-500/20 text-blue-400 ring-blue-500/50 shadow-blue-500/20',
      subText: 'text-blue-400',
      button: 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-900/20',
      focus: 'focus:border-blue-500'
    },
    ADMIN: { 
      theme: 'cyan',
      title: 'Direction Générale',
      sub: 'Contrôle Global',
      iconBg: 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/50 shadow-cyan-500/20',
      subText: 'text-cyan-400',
      button: 'from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 shadow-cyan-900/20',
      focus: 'focus:border-cyan-500'
    }
  };

  const styles = styleConfig[portal];
  
  // Cloud-ready API URL resolution
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Send the strict portal context to the Node.js backend
      const res = await axios.post(`${API_URL}/auth/login`, { 
          username, 
          password, 
          portal 
      });

      // Pass the fully authenticated payload back to App.tsx
      onLogin(res.data);

    } catch (err: any) {
      console.error("Login Error:", err);
      // Backend handles specific error messages
      const msg = err.response?.data?.error || "Identifiants incorrects ou accès refusé.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 font-sans relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Logo Header */}
      <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
         <Ship size={28} className="text-blue-500" />
         <span className="text-white font-black tracking-widest uppercase text-lg">Portail Issli</span>
      </div>

      <div className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 z-10">
        
        <div className="mb-10 text-center">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ring-1 shadow-lg ${styles.iconBg}`}>
                <Ship size={32} />
            </div>
            
            <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">{styles.title}</h2>
            <p className={`font-bold text-xs uppercase tracking-widest ${styles.subText}`}>{styles.sub}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl backdrop-blur-md shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Identifiant</label>
                    <input type="text" required autoFocus 
                        className={`w-full pl-4 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-xl outline-none text-white placeholder-slate-700 font-medium text-sm transition-all ${styles.focus}`} 
                        placeholder="Votre identifiant" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mot de passe</label>
                    <input type="password" required 
                        className={`w-full pl-4 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-xl outline-none text-white placeholder-slate-700 font-medium text-sm transition-all ${styles.focus}`} 
                        placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl flex items-center gap-3">
                        <AlertCircle size={16} className="shrink-0" /> <span>{error}</span>
                    </div>
                )}

                <button type="submit" disabled={loading} 
                    className={`w-full bg-gradient-to-r text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 active:scale-[0.98] ${styles.button}`}>
                    {loading ? "Connexion en cours..." : <>Accéder au portail <ArrowRight size={18} /></>}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};