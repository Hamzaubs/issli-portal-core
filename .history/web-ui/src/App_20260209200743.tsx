// apps/web-ui/src/App.tsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, LayoutDashboard, Anchor, Receipt, LogOut, User, Grid, Users } from 'lucide-react'; 
import { Login } from './components/Login';
import { SessionSelector } from './components/SessionSelector';
import { GlobalDashboard } from './components/GlobalDashboard';
import { LegalDashboard } from './components/LegalDashboard';
import { Dashboard } from './components/Dashboard'; 

// ✅ UNIFIED IMPORT: We only need this one manager now
import { ClientManager } from './components/ClientManager';
import { LegacyExchangeWizard } from './components/LegacyExchangeWizard';

type UserRole = 'SUPER_ADMIN' | 'LEGAL_USER' | 'POS_USER';

const getUser = () => {
    try {
        const stored = localStorage.getItem('marine_user');
        if (!stored || stored === "undefined") return null;
        return JSON.parse(stored);
    } catch (e) { return null; }
};

const ProtectedRoute = ({ children, allowedRoles }: { children: any; allowedRoles: UserRole[] }) => {
  const token = localStorage.getItem('marine_token');
  const user = getUser();
  if (!token || !user?.role) return <Navigate to="/" />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

const Sidebar = ({ isOpen, close }: { isOpen: boolean; close: () => void }) => {
  const location = useLocation();
  const user = getUser();
  const role: UserRole = user?.role || 'POS_USER'; 

  const NavItem = ({ to, icon: Icon, label }: any) => (
    <Link to={to} onClick={close}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold mb-1 ${
        location.pathname === to ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      <div className={`fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={close} />
      <div className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-8 pb-6">
            <div className="flex items-center gap-3 text-white mb-8">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-black text-xl">I</div>
                <div>
                    <h1 className="font-black text-lg">ISSLI PECHE</h1>
                    <p className="text-[10px] text-blue-400 font-bold uppercase">ERP v3.9</p>
                </div>
            </div>
            {user && (
                <div className="bg-slate-800/50 rounded-xl p-4 flex items-center gap-3 border border-slate-700">
                    <div className="p-2 bg-slate-700 rounded-lg text-slate-300"><User size={16} /></div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{user.username}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{role.replace('_', ' ')}</p>
                    </div>
                </div>
            )}
        </div>

        <nav className="flex-1 px-4 overflow-y-auto">
            <NavItem to="/" icon={Grid} label="Menu Principal" />
            <div className="my-4 border-t border-slate-800"></div>

            {role === 'SUPER_ADMIN' && location.pathname.includes('/admin') && (
                 <NavItem to="/admin" icon={LayoutDashboard} label="Tableau de Bord" />
            )}

            {(role === 'SUPER_ADMIN' || role === 'LEGAL_USER') && location.pathname.includes('/legal') && (
                 <>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500">Gestion Légale</div>
                    <NavItem to="/legal" icon={Receipt} label="Factures & Devis" />
                    {/* ✅ NEW: CLIENTS BUTTON */}
                    <NavItem to="/legal/clients" icon={Users} label="Clients & Dettes" />
                </>
            )}
            
            {(role === 'SUPER_ADMIN' || role === 'POS_USER') && location.pathname.includes('/pos') && (
                <>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500">Point de Vente</div>
                    <NavItem to="/pos" icon={Anchor} label="Opérations & Stock" />
                    <NavItem to="/pos/clients" icon={Users} label="Clients & Dettes" />
                </>
            )}
        </nav>

        <div className="p-4 border-t border-slate-800">
            <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold">
                <LogOut size={20} />
                <span>Déconnexion</span>
            </button>
        </div>
      </div>
    </>
  );
};

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} close={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300">
        <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-30 shadow-md">
              <div className="font-black text-lg">ISSLI PECHE ERP</div>
              <button onClick={() => setSidebarOpen(true)} className="p-2 bg-slate-800 rounded-lg"><Menu size={20} /></button>
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative w-full bg-[#F8FAFC]">
            <Routes>
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><GlobalDashboard /></ProtectedRoute>} />
                <Route path="/legal" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']}><LegalDashboard /></ProtectedRoute>} />
                <Route path="/legal/exchange" element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']}>
                        <LegacyExchangeWizard />
                    </ProtectedRoute>
                } />
                {/* ✅ LEGAL CLIENTS PAGE */}
                <Route path="/legal/clients" element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']}>
                        <ClientManager mode="LEGAL" />
                    </ProtectedRoute>
                } /> 
                
                <Route path="/pos" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_USER']}><Dashboard /></ProtectedRoute>} />
                <Route path="/pos/clients" element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_USER']}>
                        <ClientManager mode="INTERNAL" />
                    </ProtectedRoute>
                } />
            </Routes>
        </main>
      </div>
    </div>
  );
};

function App() {
  const handleLoginSuccess = (data: { user: any, token: string }) => {
    localStorage.setItem('marine_token', data.token);
    localStorage.setItem('marine_user', JSON.stringify(data.user));

    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');
    
    if (target) {
        if (target === 'POS') window.location.href = '/pos';
        else if (target === 'LEGAL') window.location.href = '/legal';
        else if (target === 'ADMIN') window.location.href = '/admin';
        else window.location.href = '/'; 
    } else {
        if (data.user.role === 'POS_USER') window.location.href = '/pos';
        else if (data.user.role === 'LEGAL_USER') window.location.href = '/legal';
        else window.location.href = '/'; 
    }
  };

  return (
    <Routes>
       <Route path="/" element={<SessionSelector user={getUser()} />} />
       <Route path="/login" element={<Login onLogin={handleLoginSuccess} />} />
       <Route path="/*" element={<AppLayout />} />
    </Routes>
  );
}

export default function AppWrapper() {
    return (
        <Router>
            <App />
        </Router>
    );
}