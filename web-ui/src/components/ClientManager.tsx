// web-ui/src/components/ClientManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Search, Plus, User, MapPin, Phone, 
    Trash2, Edit2, ChevronLeft, ChevronRight, Users, X, Eye, 
    Banknote, Wallet
} from 'lucide-react';
import client from '../api/client';
import { ClientTableLegal } from './ClientTableLegal'; 
import { ClientProfile } from './ClientProfile'; 

function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const InternalManager: React.FC = () => {
    // 🛡️ RBAC: Security Check
    const currentUser = JSON.parse(localStorage.getItem('marine_user') || '{}');
    const isAdmin = currentUser.role === 'SUPER_ADMIN';

    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    const [viewMode, setViewMode] = useState<'ALL' | 'DEBT'>('ALL'); 
    const [globalDebt, setGlobalDebt] = useState(0);

    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', ice: '', address: '', phone: '' });
    const [viewingClientId, setViewingClientId] = useState<string | null>(null);

    const fetchClients = async (query: string, pageNum: number, mode: string) => {
        setLoading(true);
        try {
            const res = await client.get(`/internal/clients?q=${query}&page=${pageNum}&limit=12&mode=${mode}`);
            setClients(res.data.data);
            setTotalPages(res.data.meta.pages);
            if (res.data.meta.globalDebt !== undefined) setGlobalDebt(res.data.meta.globalDebt);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const debouncedFetch = useCallback(debounce((q, p, m) => fetchClients(q, p, m), 300), []);

    useEffect(() => { 
        debouncedFetch(search, page, viewMode); 
    }, [search, page, viewMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            if (editingId) await client.put(`/internal/clients/${editingId}`, formData);
            else await client.post('/internal/clients', formData);
            
            setShowForm(false); 
            setEditingId(null); 
            setFormData({ name: '', ice: '', address: '', phone: '' });
            fetchClients(search, page, viewMode);
        } catch (error: any) { 
            alert("Erreur: " + (error.response?.data?.error || "Erreur serveur")); 
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Voulez-vous vraiment supprimer ce client ?")) return;
        try { 
            await client.delete(`/internal/clients/${id}`); 
            fetchClients(search, page, viewMode); 
        } catch (error: any) { 
            alert("Erreur: " + (error.response?.data?.error || "Erreur lors de la suppression")); 
        }
    };

    const handleEdit = (c: any) => {
        setFormData({ name: c.name, ice: c.ice || '', address: c.address || '', phone: c.phone || '' });
        setEditingId(c.id); setShowForm(true);
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
            
            {/* HEADER & TOGGLE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <Users className="text-emerald-600" size={32}/> 
                        {viewMode === 'DEBT' ? 'RECOUVREMENT' : 'CLIENTS'} 
                        <span className="text-slate-300 font-light">|</span> 
                        <span className="text-emerald-600">INTERNE</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {viewMode === 'DEBT' ? 'Gestion des impayés et relances' : 'Annuaire client Big Data'}
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
                        <button onClick={() => setViewMode('ALL')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'ALL' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                            Annuaire
                        </button>
                        <button onClick={() => setViewMode('DEBT')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'DEBT' ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <Wallet size={16}/> Créances
                        </button>
                    </div>
                    <button onClick={() => { setEditingId(null); setFormData({ name: '', ice: '', address: '', phone: '' }); setShowForm(true); }} className="px-6 py-3 rounded-xl text-white font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
                        <Plus size={20}/> <span className="hidden md:inline">Nouveau</span>
                    </button>
                </div>
            </div>

            {/* GLOBAL DEBT DASHBOARD */}
            {viewMode === 'DEBT' && (
                <div className="bg-red-900 text-white p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div>
                        <p className="text-red-200 font-bold uppercase text-xs tracking-widest mb-1">Encours Global (Dette Client)</p>
                        <h2 className="text-4xl font-black tracking-tighter">{formatMAD(globalDebt)}</h2>
                    </div>
                    <div className="text-right z-10">
                        <p className="text-red-200 text-sm font-medium">Argent dehors</p>
                        <p className="text-xs opacity-50 mt-1">Calculé sur l'ensemble du portefeuille</p>
                    </div>
                </div>
            )}

            {/* SEARCH BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-4 items-center">
                <div className="flex-1 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/><input type="text" placeholder="Rechercher (Nom, Tél, ICE)..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-lg outline-none font-medium" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 hover:bg-white rounded disabled:opacity-50"><ChevronLeft size={20}/></button>
                    <span className="text-sm font-bold text-slate-600 px-2">{page} / {totalPages || 1}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 hover:bg-white rounded disabled:opacity-50"><ChevronRight size={20}/></button>
                </div>
            </div>

            {/* GRID DISPLAY */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading && clients.length === 0 ? <div className="col-span-3 text-center py-10 text-slate-400">Chargement...</div> : 
                 clients.length === 0 ? <div className="col-span-3 text-center py-20 text-slate-400 italic">Aucun client trouvé.</div> :
                 clients.map(client => (
                    <div key={client.id} className={`bg-white rounded-2xl p-6 shadow-sm border transition-all group relative overflow-hidden ${client.balance > 0 ? 'border-red-100 hover:border-red-300' : 'border-slate-200 hover:shadow-md'}`}>
                        <div className={`absolute top-0 right-0 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl border-l border-b ${client.balance > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                             {client.balance > 0 ? `Dette: ${formatMAD(client.balance)}` : 'À jour'}
                        </div>

                        <div className="flex justify-between items-start mb-4 mt-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${client.balance > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setViewingClientId(client.id)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"><Eye size={18}/></button>
                                <button onClick={() => handleEdit(client)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                {/* 🛡️ RBAC */}
                                {isAdmin && (
                                    <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                )}
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-black text-slate-800 mb-1 truncate">{client.name}</h3>
                        <div className="space-y-2 mt-4 text-xs text-slate-500">
                            {client.phone && <div className="flex items-center gap-2"><Phone size={14}/> {client.phone}</div>}
                            {client.address && <div className="flex items-center gap-2"><MapPin size={14}/> <span className="truncate max-w-[200px]">{client.address}</span></div>}
                        </div>

                        {client.balance > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-end">
                                <button onClick={() => setViewingClientId(client.id)} className="text-xs font-bold text-red-600 flex items-center gap-1 hover:underline">
                                    <Banknote size={14}/> Encaisser
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* MODALS */}
            {viewingClientId && <ClientProfile clientId={viewingClientId} onClose={() => { setViewingClientId(null); fetchClients(search, page, viewMode); }} />}

            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h2 className="font-black text-slate-800">{editingId ? 'Modifier' : 'Nouveau'}</h2><button onClick={() => setShowForm(false)}><X size={20}/></button></div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Nom Complet *</label><input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase">ICE</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.ice} onChange={e => setFormData({...formData, ice: e.target.value})} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Adresse</label><input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                            <button disabled={isSubmitting} className="w-full py-4 rounded-xl text-white font-bold shadow-lg mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                {isSubmitting ? 'Validation...' : 'Enregistrer'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ClientManagerProps { mode: 'LEGAL' | 'INTERNAL'; }
export const ClientManager: React.FC<ClientManagerProps> = ({ mode }) => {
    if (mode === 'LEGAL') return <ClientTableLegal />;
    return <InternalManager />;
};