import React, { useState, useEffect, useCallback } from 'react';
import { 
    Search, Plus, User, MapPin, Phone, 
    Trash2, Edit2, ChevronLeft, ChevronRight, Users, X, AlertTriangle, ShieldAlert
} from 'lucide-react';
import client from '../api/client';
import debounce from 'lodash.debounce'; 
// We use the same ClientTableLegal logic but adapted for Silo B's view
import { ClientTableLegal } from './ClientTableLegal'; 

// =================================================================
// 🟢 INTERNAL MANAGER (Big Data Optimized)
// =================================================================
const InternalManager: React.FC = () => {
    // Data State
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Search & Pagination State
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', ice: '', address: '', phone: '', creditLimit: '' });

    // 1. Fetch Clients (Server-Side Search)
    const fetchClients = async (query: string, pageNum: number) => {
        setLoading(true);
        try {
            // ✅ Connects to the new Big Data Endpoint
            const res = await client.get(`/internal/clients?q=${query}&page=${pageNum}&limit=12`);
            setClients(res.data.data);
            setTotalPages(res.data.meta.pages);
        } catch (error) { 
            console.error("Erreur chargement clients", error); 
        } finally { 
            setLoading(false); 
        }
    };

    // Debounced Search Handler (Prevents API spam)
    const debouncedFetch = useCallback(debounce((q, p) => fetchClients(q, p), 300), []);

    useEffect(() => {
        debouncedFetch(search, page);
    }, [search, page]);

    // 2. Submit Logic (Create/Edit)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0
            };

            if (editingId) {
                await client.put(`/internal/clients/${editingId}`, payload);
            } else {
                await client.post('/internal/clients', payload);
            }
            setShowForm(false);
            setEditingId(null);
            setFormData({ name: '', ice: '', address: '', phone: '', creditLimit: '' });
            fetchClients(search, page); // Refresh list
        } catch (error: any) { 
            alert("Erreur: " + (error.response?.data?.error || "Enregistrement impossible")); 
        }
    };

    // 3. Delete Logic
    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce client ?")) return;
        try {
            await client.delete(`/internal/clients/${id}`);
            fetchClients(search, page);
        } catch (error: any) { 
            alert("Erreur: " + (error.response?.data?.error || "Impossible de supprimer")); 
        }
    };

    const handleEdit = (c: any) => {
        setFormData({ 
            name: c.name, 
            ice: c.ice || '', 
            address: c.address || '', 
            phone: c.phone || '',
            creditLimit: c.creditLimit ? c.creditLimit.toString() : ''
        });
        setEditingId(c.id);
        setShowForm(true);
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <Users className="text-emerald-600" size={32} /> 
                        CLIENTS <span className="text-slate-300 font-light">|</span> <span className="text-emerald-600">INTERNE</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gestion optimisée Big Data ( {clients.length} affichés )</p>
                </div>
                <button onClick={() => { setEditingId(null); setFormData({ name: '', ice: '', address: '', phone: '', creditLimit: '' }); setShowForm(true); }} 
                    className="px-6 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
                    <Plus size={20}/> Nouveau Client
                </button>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-4 items-center">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                    <input type="text" placeholder="Rechercher par nom, téléphone, ICE..." 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                {/* Pagination Controls */}
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 hover:bg-white rounded shadow-sm disabled:opacity-50"><ChevronLeft size={20}/></button>
                    <span className="text-sm font-bold text-slate-600 px-2">Page {page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 hover:bg-white rounded shadow-sm disabled:opacity-50"><ChevronRight size={20}/></button>
                </div>
            </div>

            {/* GRID DISPLAY */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading && clients.length === 0 ? (
                    <div className="col-span-3 text-center py-10 text-slate-400">Chargement...</div>
                ) : clients.map(client => (
                    <div key={client.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all group relative overflow-hidden">
                        {/* Debt Badge */}
                        <div className={`absolute top-0 right-0 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl border-l border-b ${client.balance > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                             {client.balance > 0 ? `Dette: ${formatMAD(client.balance)}` : 'À jour'}
                        </div>

                        <div className="flex justify-between items-start mb-4 mt-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xl">
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(client)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-black text-slate-800 mb-1 truncate">{client.name}</h3>
                        
                        <div className="space-y-2 mt-4 text-xs text-slate-500">
                            {client.phone && <div className="flex items-center gap-2"><Phone size={14}/> {client.phone}</div>}
                            {client.address && <div className="flex items-center gap-2"><MapPin size={14}/> <span className="truncate max-w-[200px]">{client.address}</span></div>}
                            
                            {/* Credit Limit Indicator */}
                            {client.creditLimit > 0 && (
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                                    <ShieldAlert size={14} className={client.balance > client.creditLimit ? "text-red-500" : "text-emerald-500"}/>
                                    <span className="font-bold text-slate-700">Plafond: {formatMAD(client.creditLimit)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {!loading && clients.length === 0 && (
                    <div className="col-span-3 text-center py-20 text-slate-400 italic">Aucun client trouvé.</div>
                )}
            </div>

            {/* FORM MODAL */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="font-black text-slate-800">{editingId ? 'Modifier Client' : 'Nouveau Client'}</h2>
                            <button onClick={() => setShowForm(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom complet *</label>
                                <input required autoFocus type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                                    <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ICE (Optionnel)</label>
                                    <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                                        value={formData.ice} onChange={e => setFormData({...formData, ice: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adresse</label>
                                <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                                    value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                            </div>
                            
                            {/* Credit Limit Field */}
                            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                                <label className="block text-xs font-bold text-orange-700 uppercase mb-1 flex items-center gap-2">
                                    <ShieldAlert size={14}/> Plafond de Crédit
                                </label>
                                <input type="number" placeholder="0 = Illimité" className="w-full p-2 bg-white border border-orange-200 rounded-lg text-orange-800 font-bold outline-none focus:ring-2 focus:ring-orange-300"
                                    value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: e.target.value})} />
                            </div>

                            <button className="w-full py-4 rounded-xl text-white font-bold shadow-lg mt-4 bg-emerald-600 hover:bg-emerald-700 transition-all">Enregistrer</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// =================================================================
// 🛡️ MAIN WRAPPER
// =================================================================
interface ClientManagerProps {
    mode: 'LEGAL' | 'INTERNAL';
}

export const ClientManager: React.FC<ClientManagerProps> = ({ mode }) => {
    if (mode === 'LEGAL') {
        return <ClientTableLegal />;
    }
    return <InternalManager />;
};