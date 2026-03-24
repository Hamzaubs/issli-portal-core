// web-ui/src/components/SessionSelector.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Receipt, LayoutDashboard, ArrowRight, Lock, User } from 'lucide-react';

interface SessionSelectorProps {
  user?: any;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({ user }) => {
  const navigate = useNavigate();
  // Strict boolean check for login status
  const isLoggedIn = user && user.id && user.role; 
  const role = user?.role || '';

  const canAccess = (requiredRole: string[]) => {
    if (!isLoggedIn) return true; // Public mode: All cards clickable (to lead to login)
    return requiredRole.includes(role);
  };

  const handleNavigation = (path: string, targetMode: string) => {
    if (isLoggedIn) {
       navigate(path);
    } else {
       navigate(`/login?target=${targetMode}`);
    }
  };

  // ✅ STYLE CONFIG: Explicitly defined classes for Tailwind JIT
  const styleConfig: Record<string, any> = {
    emerald: {
      blob: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/50 shadow-emerald-500/20',
      borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
      gradient: 'from-emerald-500/20 to-emerald-600/20'
    },
    blue: {
      blob: 'bg-blue-500/10 text-blue-400 ring-blue-500/50 shadow-blue-500/20',
      borderHover: 'hover:border-blue-500/50 hover:shadow-blue-500/10',
      gradient: 'from-blue-500/20 to-blue-600/20'
    },
    cyan: { // 🌊 STOCK GLOBALE Theme
      blob: 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/50 shadow-cyan-500/20',
      borderHover: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10',
      gradient: 'from-cyan-500/20 to-cyan-600/20'
    }
  };

  const SessionCard = ({ title, desc, icon: Icon, path, targetMode, color, requiredRoles, delay }: any) => {
    const isLocked = isLoggedIn && !canAccess(requiredRoles); 
    const styles = styleConfig[color]; // Get explicit styles

    return (
      <button 
        onClick={() => !isLocked && handleNavigation(path, targetMode)}
        disabled={isLocked}
        className={`group relative flex flex-col items-start text-left p-8 rounded-3xl transition-all duration-500 w-full md:w-[350px] border
        ${isLocked 
          ? 'opacity-40 grayscale cursor-not-allowed bg-slate-900 border-slate-800' 
          : `bg-slate-900/80 hover:bg-slate-800 border-slate-800 cursor-pointer hover:-translate-y-2 hover:shadow-2xl ${styles.borderHover}`
        } animate-in fade-in slide-in-from-bottom-8 fill-mode-backwards backdrop-blur-md`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {/* Icon Blob - Using Explicit Styles */}
        <div className={`w-16 h-16 rounded-2xl mb-6 flex items-center justify-center text-2xl transition-transform group-hover:scale-110 duration-500
          ${isLocked ? 'bg-slate-800 text-slate-600' : `bg-gradient-to-br ${styles.gradient} ring-1 shadow-lg ${styles.blob}`}`}>
          {isLocked ? <Lock size={28} /> : <Icon size={32} />}
        </div>

        {/* Text */}
        <h3 className={`text-2xl font-black uppercase tracking-tight mb-2 ${isLocked ? 'text-slate-600' : 'text-white'}`}>
          {title}
        </h3>
        <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 h-10">
          {desc}
        </p>

        {/* Action Button - Always Blue & Glowing */}
        <div className={`mt-auto flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all duration-300
           ${isLocked 
             ? 'text-slate-600' 
             : 'text-blue-400 group-hover:text-blue-300 group-hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]'
           }`}>
           {isLocked ? 'Accès Refusé' : isLoggedIn ? 'Accéder' : 'Se Connecter'}
           {!isLocked && <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform duration-300" />}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full opacity-50"></div>
         <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-cyan-600/5 blur-[100px] rounded-full opacity-30"></div>
      </div>

      {/* Header */}
      <div className="text-center mb-16 relative z-10 animate-in fade-in zoom-in duration-700">
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4 uppercase">
          ISSLI PECHE <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">ERP</span>
        </h1>
        {isLoggedIn ? (
             <p className="text-slate-400 text-lg flex items-center justify-center gap-2">
                <User size={18} /> Bonjour, <strong className="text-white">{user.username}</strong>
             </p>
        ) : (
            <p className="text-slate-400 text-lg">Sélectionnez votre espace de travail pour commencer.</p>
        )}
      </div>

      {/* Cards Container */}
      <div className="flex flex-wrap items-center justify-center gap-6 relative z-10 max-w-7xl">
        
        {/* 1. STOCK B (INTERNAL/POS) - Emerald */}
        <SessionCard 
            title="STOCK B" 
            desc="Magasin Interne, Vente Comptoir et Gestion du Stock Courant." 
            icon={Anchor} 
            path="/pos" 
            targetMode="POS" 
            color="emerald" 
            requiredRoles={['SUPER_ADMIN', 'POS_USER']} 
            delay={100} 
        />

        {/* 2. STOCK A (LEGAL) - Blue */}
        <SessionCard 
            title="STOCK A" 
            desc="Bureau Légal, Facturation Officielle (TVA) et Devis." 
            icon={Receipt} 
            path="/legal" 
            targetMode="LEGAL" 
            color="blue" 
            requiredRoles={['SUPER_ADMIN', 'LEGAL_USER']} 
            delay={200} 
        />

        {/* 3. STOCK GLOBALE (ADMIN) - Cyan */}
        <SessionCard 
            title="STOCK GLOBALE" 
            desc="Direction Générale, Consolidation des CA et Audit." 
            icon={LayoutDashboard} 
            path="/admin" 
            targetMode="ADMIN" 
            color="cyan" 
            requiredRoles={['SUPER_ADMIN']} 
            delay={300} 
        />

      </div>

      {isLoggedIn && (
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-16 text-slate-500 hover:text-red-400 text-sm font-bold uppercase tracking-widest transition-colors flex items-center gap-2 relative z-10">
            <Lock size={14} /> Se déconnecter
        </button>
      )}

      <div className="fixed bottom-6 text-[10px] text-slate-600 font-mono uppercase tracking-widest z-10">System v2.1.0 • Secure Access</div>
    </div>
  );
};