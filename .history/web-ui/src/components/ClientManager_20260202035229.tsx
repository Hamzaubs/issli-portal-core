// web-ui/src/components/ClientManager.tsx
import React, { useState, useEffect } from 'react';
import { 
    Search, Plus, User, MapPin, Phone, 
    Trash2, Edit2, AlertCircle, FileText, Printer, Link as LinkIcon, CheckCircle, Eye, Users, X
} from 'lucide-react';
import client from '../api/client';
// We use the same ClientTableLegal logic but adapted for Silo B's view
import { ClientTableLegal } from './ClientTableLegal'; 

// =================================================================
// 🟢 INTERNAL MANAGER (Silo B Logic)
// =================================================================
const InternalManager: React.FC = () => {
    const [clients, setClients] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    
    // History Modal State
    const [viewingClient, setViewingClient] = useState<any | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', ice: '', address: '', city: '', phone: '' });

    // 1. Fetch Clients (Internal View)
    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await client.get('/dashboard/clients?mode=INTERNAL'); 
            setClients(Array.isArray(res.data) ? res.data : []);
        } catch (error) { console.error("Erreur chargement clients", error); } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchClients(); }, []);

    // 2. Open History
    const openHistory = async (id: string) => {
        setLoadingHistory(true);
        try {
            const res = await client.get(`/dashboard/clients/${id}/details`);
            if (res.data) {
                const legalDocs = (res.data.history?.legal || []).map((d: any) => ({ ...d, source: 'LEGAL', sortDate: new Date(d.issuedAt) }));
                const internalOps = (res.data.history?.internal || []).map((d: any) => ({ ...d, source: 'INTERNAL', sortDate: new Date(d.createdAt) }));
                const mergedHistory = [...legalDocs, ...internalOps].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

                setViewingClient({
                    ...res.data.profile,
                    stats: res.data.stats,
                    unifiedHistory: mergedHistory
                });
            }
        } catch (err) { alert("Erreur chargement historique."); }
        finally { setLoadingHistory(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await client.put(`/dashboard/clients/${editingId}`, formData);
            } else {
                await client.post('/dashboard/clients', formData);
            }
            setShowForm(false);
            setEditingId(null);
            setFormData({ name: '', ice: '', address: '', city: '', phone: '' });
            fetchClients();
        } catch (error) { alert("Erreur lors de l'enregistrement"); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce client ?")) return;
        try {
            await client.delete(`/dashboard/clients/${id}`);
            fetchClients();
        } catch (error) { alert("Impossible de supprimer"); }
    };

    const handleEdit = (c: any) => {
        setFormData({ 
            name: c.name, ice: c.ice || '', address: c.address || '', city: c.city || '', phone: c.phone || ''
        });
        setEditingId(c.id);
        setShowForm(true);
    };

    const filtered = (clients || []).filter(c => c?.name?.toLowerCase().includes(search.toLowerCase()) || c?.phone?.includes(search));
    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);
    const safeDate = (d: any) => {
        if (!d) return '-';
        try { return new Date(d).toLocaleDateString('fr-MA'); } catch { return '-'; }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <Users className="text-emerald-600" size={32} /> 
                        CLIENTS <span className="text-slate-300 font-light">|</span> <span className="text-emerald-600">INTERNE</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Suivi des clients locaux et des dettes (POS).</p>
                </div>
                <button onClick={() => { setEditingId(null); setFormData({ name: '', ice: '', address: '', city: '', phone: '' }); setShowForm(true); }} 
                    className="px-6 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
                    <Plus size={20}/> Nouveau Client
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                    <input type="text" placeholder="Rechercher par nom, téléphone..." 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                        value={search} onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(client => (
                    <div key={client.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all group relative overflow-hidden">
                        {client.balance > 0 && (
                             <div className="absolute top-0 right-0 bg-red-50 text-red-600 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl border-l border-b border-red-100">
                                 Dette: {formatMAD(client.balance)}
                             </div>
                        )}
                        <div className="flex justify-between items-start mb-4 mt-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xl">
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => openHistory(client.id)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="Vue Globale">
                                    {loadingHistory ? '...' : <Eye size={18}/>}
                                </button>
                                <button onClick={() => handleEdit(client)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-1">{client.name}</h3>
                        <div className="space-y-2 mt-4 text-xs text-slate-500">
                            {client.phone && <div className="flex items-center gap-2"><Phone size={14}/> {client.phone}</div>}
                            {client.city && <div className="flex items-center gap-2"><MapPin size={14}/> {client.city}</div>}
                        </div>
                    </div>
                ))}
            </div>

            {/* History Modal */}
            {viewingClient && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-xl">{viewingClient.name}</h3>
                            {/* ✅ FIXED X BUTTON */}
                            <button onClick={() => setViewingClient(null)} className="p-2 hover:bg-slate-200 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                             {viewingClient.unifiedHistory.map((item: any, idx: number) => (
                                <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700">{item.source === 'LEGAL' ? item.reference : item.product?.name || 'Vente'}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.source === 'LEGAL' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.source}</span>
                                        </div>
                                        <p className="text-xs text-slate-400">{safeDate(item.sortDate)}</p>
                                    </div>
                                    <div className="font-bold">{formatMAD(item.totalTTC || item.amount)}</div>
                                </div>
                             ))}
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="font-black text-slate-800">{editingId ? 'Modifier Client' : 'Nouveau Client'}</h2>
                            <button onClick={() => setShowForm(false)}><User size={20} className="text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Nom</label><input required autoFocus type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label><input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Ville</label><input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                            </div>
                            <button className="w-full py-4 rounded-xl text-white font-bold shadow-lg mt-4 bg-emerald-600 hover:bg-emerald-700">Enregistrer</button>
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