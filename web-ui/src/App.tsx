// web-ui/src/App.tsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  Menu, LayoutDashboard, Anchor, Receipt, LogOut, User, Grid, 
  Users, Truck, ShoppingCart, ClipboardCheck, Ship 
} from 'lucide-react'; 

import { Login, PortalMode } from './components/Login';
import { GlobalDashboard } from './components/GlobalDashboard';
import { LegalDashboard } from './components/LegalDashboard';
import { Dashboard } from './components/Dashboard'; 
import { InventoryDashboard } from './components/InventoryDashboard';
import { ClientManager } from './components/ClientManager';
import { LegacyExchangeWizard } from './components/LegacyExchangeWizard';
import { SupplierManager } from './components/SupplierManager';
import { PurchaseManager } from './components/PurchaseManager';

type UserRole = 'SUPER_ADMIN' | 'LEGAL_USER' | 'POS_USER';

const getUser = () => {
    try {
        const stored = localStorage.getItem('marine_user');
        if (!stored || stored === "undefined") return null;
        return JSON.parse(stored);
    } catch (e) { return null; }
};

const getActivePortal = (): PortalMode | null => {
    return localStorage.getItem('marine_portal') as PortalMode | null;
};

const ProtectedRoute = ({ children, allowedRoles, requiredPortal }: { children: any; allowedRoles: UserRole[], requiredPortal: PortalMode }) => {
  const token = localStorage.getItem('marine_token');
  const user = getUser();
  const activePortal = getActivePortal();
  
  if (!token || !user?.role) return <Navigate to="/" />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
  
  // 🛡️ FRONTEND PORTAL GUARD: Prevents a POS token from rendering Legal UI
  if (activePortal !== requiredPortal && activePortal !== 'ADMIN') {
      return <Navigate to="/" />;
  }
  
  return children;
};

const Sidebar = ({ isOpen, close }: { isOpen: boolean; close: () => void }) => {
  const location = useLocation();
  const user = getUser();
  const role: UserRole = user?.role || 'POS_USER'; 
  const activePortal = getActivePortal();

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
        
        <div className="p-8 pb-6 border-b border-slate-800">
            {/* BRANDING: Desktop Logo Area */}
            <div className="flex items-center gap-3 text-blue-500 mb-8">
                <Ship size={36} strokeWidth={2.5} className="text-blue-500 drop-shadow-md" />
                <div>
                    <h1 className="text-xl font-black tracking-wider uppercase leading-none text-white">
                        Portail Issli
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Système de Gestion
                    </p>
                </div>
            </div>
            {user && (
                <div className="bg-slate-800/50 rounded-xl p-4 flex items-center gap-3 border border-slate-700">
                    <div className="p-2 bg-slate-700 rounded-lg text-slate-300"><User size={16} /></div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{user.username}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            {role === 'SUPER_ADMIN' ? 'Administrateur' : role === 'LEGAL_USER' ? 'Comptabilité' : 'Point de Vente'} 
                            {' '}• {activePortal === 'ADMIN' ? 'GLOBAL' : activePortal === 'LEGAL' ? 'LÉGAL' : 'MAGASIN'}
                        </p>
                    </div>
                </div>
            )}
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto">
            {/* ONLY show Admin links if physically logged into the ADMIN portal */}
            {role === 'SUPER_ADMIN' && activePortal === 'ADMIN' && (
                 <NavItem to="/admin" icon={LayoutDashboard} label="Tableau de Bord" />
            )}

            {/* Show Legal links if in LEGAL portal (or if Admin is browsing globally) */}
            {(role === 'SUPER_ADMIN' || role === 'LEGAL_USER') && (activePortal === 'LEGAL' || activePortal === 'ADMIN') && (
                 <>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 mt-2">Gestion Légale</div>
                    <NavItem to="/legal" icon={Receipt} label="Factures & Devis" />
                    <NavItem to="/legal/clients" icon={Users} label="Clients (Silo A)" />
                    <NavItem to="/legal/suppliers" icon={Truck} label="Fournisseurs" />
                    <NavItem to="/legal/purchases" icon={ShoppingCart} label="Achats & Dépenses" /> 
                </>
            )}
            
            {/* Show POS links if in POS portal (or if Admin is browsing globally) */}
            {(role === 'SUPER_ADMIN' || role === 'POS_USER') && (activePortal === 'POS' || activePortal === 'ADMIN') && (
                <>
                    <div className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 mt-4">Point de Vente</div>
                    <NavItem to="/pos" icon={Anchor} label="Opérations & Stock" />
                    <NavItem to="/pos/clients" icon={Users} label="Clients & Dettes" />
                    <NavItem to="/pos/suppliers" icon={Truck} label="Fournisseurs (Silo B)" />
                    <NavItem to="/pos/purchases" icon={ShoppingCart} label="Achats (Silo B)" />
                    <NavItem to="/pos/inventory" icon={ClipboardCheck} label="Inventaire (Vérité)" />
                </>
            )}
        </nav>

        <div className="p-4 border-t border-slate-800">
            <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold transition-colors">
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
        
        {/* BRANDING: Mobile Header */}
        <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-30 shadow-md">
              <div className="flex items-center gap-2">
                  <Ship size={24} className="text-blue-500" />
                  <div className="font-black text-lg tracking-wider uppercase">Portail Issli</div>
              </div>
              <button onClick={() => setSidebarOpen(true)} className="p-2 bg-slate-800 rounded-lg"><Menu size={20} /></button>
        </div>
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative w-full bg-[#F8FAFC]">
            <Routes>
                {/* GLOBAL ADMIN */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} requiredPortal="ADMIN"><GlobalDashboard /></ProtectedRoute>} />
                
                {/* SILO A (LEGAL) ROUTES */}
                <Route path="/legal" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']} requiredPortal="LEGAL"><LegalDashboard /></ProtectedRoute>} />
                <Route path="/legal/exchange" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']} requiredPortal="LEGAL"><LegacyExchangeWizard /></ProtectedRoute>} />
                <Route path="/legal/clients" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']} requiredPortal="LEGAL"><ClientManager mode="LEGAL" /></ProtectedRoute>} /> 
                <Route path="/legal/suppliers" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']} requiredPortal="LEGAL"><SupplierManager mode="LEGAL" /></ProtectedRoute>} /> 
                <Route path="/legal/purchases" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL_USER']} requiredPortal="LEGAL"><PurchaseManager mode="LEGAL" /></ProtectedRoute>} />

                {/* SILO B (INTERNAL/POS) ROUTES */}
                <Route path="/pos" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_USER']} requiredPortal="POS"><Dashboard /></ProtectedRoute>} />
                <Route path="/pos/clients" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_USER']} requiredPortal="POS"><ClientManager mode="INTERNAL" /></ProtectedRoute>} />
                <Route path="/pos/suppliers" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_USER']} requiredPortal="POS"><SupplierManager mode="INTERNAL" /></ProtectedRoute>} />
                <Route path="/pos/purchases" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_USER']} requiredPortal="POS"><PurchaseManager mode="INTERNAL" /></ProtectedRoute>} />
                <Route path="/pos/inventory" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'POS_USER']} requiredPortal="POS"><InventoryDashboard /></ProtectedRoute>} />
            </Routes>
        </main>
      </div>
    </div>
  );
};

function App() {
  const handleLoginSuccess = (data: { user: any, token: string, portal: PortalMode }) => {
    localStorage.setItem('marine_token', data.token);
    localStorage.setItem('marine_user', JSON.stringify(data.user));
    localStorage.setItem('marine_portal', data.portal); // 🛡️ Save the active portal context

    // Direct routing based on the portal
    if (data.portal === 'ADMIN') window.location.href = '/admin';
    else if (data.portal === 'LEGAL') window.location.href = '/legal';
    else if (data.portal === 'POS') window.location.href = '/pos';
  };

  // Smart redirect if already logged in
  const RedirectIfLoggedIn = ({ children, targetPortal }: { children: any, targetPortal: PortalMode }) => {
      const activePortal = getActivePortal();
      const token = localStorage.getItem('marine_token');
      
      if (token && activePortal === targetPortal) {
          if (activePortal === 'ADMIN') return <Navigate to="/admin" replace />;
          if (activePortal === 'LEGAL') return <Navigate to="/legal" replace />;
          if (activePortal === 'POS') return <Navigate to="/pos" replace />;
      }
      return children;
  };

  return (
    <Routes>
        {/* Default Route: Implicitly the POS portal */}
        <Route path="/" element={
            <RedirectIfLoggedIn targetPortal="POS">
                <Login portal="POS" onLogin={handleLoginSuccess} />
            </RedirectIfLoggedIn>
        } />
        
        {/* Obfuscated Routes for Sensitive Portals */}
        <Route path="/thelegal-portal" element={
            <RedirectIfLoggedIn targetPortal="LEGAL">
                <Login portal="LEGAL" onLogin={handleLoginSuccess} />
            </RedirectIfLoggedIn>
        } />
        <Route path="/theadmin-portal" element={
            <RedirectIfLoggedIn targetPortal="ADMIN">
                <Login portal="ADMIN" onLogin={handleLoginSuccess} />
            </RedirectIfLoggedIn>
        } />
        
        {/* Authenticated System */}
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