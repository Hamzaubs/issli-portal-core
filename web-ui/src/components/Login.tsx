// web-ui/src/components/Login.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';

interface LoginProps {
  onLogin: (data: { user: any, token: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const targetMode = params.get('target') || 'GENERAL';

  // ✅ STYLE CONFIG: Explicitly defined for Tailwind JIT stability
  const styleConfig: Record<string, any> = {
    emerald: {
      theme: 'emerald',
      iconBg: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/50 shadow-emerald-500/20',
      subText: 'text-emerald-400',
      button: 'from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-900/20',
      focus: 'focus:border-emerald-500'
    },
    blue: {
      theme: 'blue',
      iconBg: 'bg-blue-500/20 text-blue-400 ring-blue-500/50 shadow-blue-500/20',
      subText: 'text-blue-400',
      button: 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-900/20',
      focus: 'focus:border-blue-500'
    },
    cyan: { // 🌊 STOCK GLOBALE Theme
      theme: 'cyan',
      iconBg: 'bg-cyan-500/20 text-cyan-400 ring-cyan-500/50 shadow-cyan-500/20',
      subText: 'text-cyan-400',
      button: 'from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 shadow-cyan-900/20',
      focus: 'focus:border-cyan-500'
    }
  };

  const getBranding = () => {
      switch(targetMode) {
          case 'POS': return { title: 'STOCK B', styles: styleConfig.emerald, sub: 'Point de Vente (Interne)' };
          case 'LEGAL': return { title: 'STOCK A', styles: styleConfig.blue, sub: 'Bureau Légal (Officiel)' };
          case 'ADMIN': return { title: 'STOCK GLOBALE', styles: styleConfig.cyan, sub: 'Direction Générale' };
          default: return { title: 'ISSLI PECHE', styles: styleConfig.blue, sub: 'Accès ERP' };
      }
  };
  const brand = getBranding();
  const styles = brand.styles;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post('http://localhost:3000/api/auth/login', { username, password });
      const user = res.data.user;

      console.log("🔍 LOGIN CHECK:", { userRole: user.role, target: targetMode });

      // 🛡️ ROLE ENFORCEMENT
      if (targetMode === 'ADMIN' && user.role !== 'SUPER_ADMIN') {
          throw new Error(`Accès Refusé: Votre rôle (${user.role}) n'est pas Administrateur.`);
      }
      if (targetMode === 'LEGAL' && !['SUPER_ADMIN', 'LEGAL_USER'].includes(user.role)) {
           throw new Error("Accès Refusé: Ce compte n'a pas accès au STOCK A (Légal).");
      }
      if (targetMode === 'POS' && !['SUPER_ADMIN', 'POS_USER'].includes(user.role)) {
           throw new Error("Accès Refusé: Ce compte n'a pas accès au STOCK B (POS).");
      }

      onLogin(res.data);

    } catch (err: any) {
      console.error("Login Error:", err);
      const msg = err.response?.data?.error || err.message || "Erreur de connexion";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 font-sans">
      <div className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500">
        
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 transition-colors text-sm font-bold uppercase tracking-wide">
            <ArrowLeft size={16} /> Retour au menu
        </button>

        <div className="mb-10 text-center">
            {/* Dynamic Icon Blob */}
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ring-1 shadow-lg ${styles.iconBg}`}>
                <Lock size={32} />
            </div>
            
            <h2 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">{brand.title}</h2>
            <p className={`font-bold text-xs uppercase tracking-widest ${styles.subText}`}>{brand.sub}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl backdrop-blur-sm shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Identifiant</label>
                    <input type="text" required autoFocus 
                        className={`w-full pl-4 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-xl outline-none text-white placeholder-slate-700 font-medium text-sm transition-all ${styles.focus}`} 
                        placeholder="ex: admin" value={username} onChange={(e) => setUsername(e.target.value)} />
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
                    {loading ? "..." : <>Accéder <ArrowRight size={18} /></>}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};