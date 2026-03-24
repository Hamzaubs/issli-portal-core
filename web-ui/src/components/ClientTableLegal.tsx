// web-ui/src/components/ClientTableLegal.tsx
import React, { useState, useEffect } from 'react';
import { 
    Search, Users, Edit, Trash2, Plus, MapPin, Phone, 
    History, FileText, AlertCircle, CheckCircle, Wallet, Building2, Loader2
} from 'lucide-react';
import client from '../api/client';
import { LegalClientProfile } from './LegalClientProfile'; // ✅ 100% AIR-GAPPED PROFILE

export const ClientTableLegal = () => {
    const [clients, setClients] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Modal State
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', ice: '', address: '', city: '', phone: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const user = JSON.parse(localStorage.getItem('marine_user') || '{}');
    const isAdmin = user.role === 'SUPER_ADMIN';

    // 1. Load Clients
    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await client.get('/clients?limit=100'); 
            if (res.data && Array.isArray(res.data.data)) {
                setClients(res.data.data);
            } else {
                setClients([]);
            }
        } catch (err: any) { 
            console.error("Erreur chargement clients", err); 
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    // 2. Form Handlers
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                 await client.put(`/clients/${editingId}`, formData);
            } else {
                 await client.post('/clients', formData);
            }
            setShowForm(false);
            setEditingId(null);
            setFormData({ name: '', ice: '', address: '', city: '', phone: '' });
            fetchClients();
        } catch (error) { alert("Erreur lors de l'enregistrement."); }
    };

    const handleEdit = (c: any, e: React.MouseEvent) => {
        e.stopPropagation(); 
        setFormData({ 
            name: c.name, ice: c.ice || '', address: c.address || '', city: c.city || '', phone: c.phone || '' 
        });
        setEditingId(c.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Supprimer ce client ?")) return;
        try {
            await client.delete(`/clients/${id}`);
            fetchClients();
        } catch (error) { alert("Impossible de supprimer (Dettes actives ?)."); }
    };

    const safeMoney = (val: any) => {
        const num = Number(val);
        return isNaN(num) ? '0.00 Dhs' : new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(num);
    };

    const filteredClients = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.ice?.includes(search));

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-blue-950 flex items-center gap-3 tracking-tight">
                        <Building2 className="text-blue-700" size={32} /> 
                        CLIENTS <span className="text-slate-300 font-light">|</span> <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-lg">SILO A</span>
                    </h1>
                    <p className="text-blue-900/60 text-sm mt-1 font-medium">Répertoire Officiel (Conformité DGI & Suivi Comptable).</p>
                </div>
                {isAdmin && (
                    <button onClick={() => { setEditingId(null); setShowForm(true); }} 
                        className="px-6 py-3 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 bg-blue-800 hover:bg-blue-700 shadow-blue-200">
                        <Plus size={20}/> Nouveau Client
                    </button>
                )}
            </div>

            {/* SEARCH */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex gap-4 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <Search className="text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Rechercher par Nom, ICE..." 
                    className="flex-1 outline-none font-bold text-slate-700 placeholder:font-normal"
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                />
            </div>

            {/* GRID */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-900" size={40}/></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map((client) => (
                        <div 
                            key={client.id} 
                            onClick={() => setSelectedClientId(client.id)} // ✅ Opens Air-Gapped Profile
                            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50 transition-all group relative cursor-pointer overflow-hidden"
                        >
                            {/* Watermark */}
                            <div className="absolute right-0 top-0 opacity-[0.03] text-blue-900 transform translate-x-4 -translate-y-4"><Building2 size={120}/></div>

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-black text-xl border border-slate-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {client.debt > 0.5 ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Dette Légale</span>
                                            <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg text-sm font-black border border-red-100 flex items-center gap-1">
                                                <AlertCircle size={14} /> -{safeMoney(client.debt)}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-xs font-black border border-emerald-100 flex items-center gap-1">
                                            <CheckCircle size={12} /> À jour
                                        </span>
                                    )}
                                </div>
                            </div>

                            <h3 className="font-bold text-lg text-slate-900 mb-1 truncate relative z-10">{client.name}</h3>
                            <div className="space-y-2 mt-4 text-sm text-slate-500 mb-4 border-b border-slate-100 pb-4 relative z-10">
                                {client.ice && <div className="flex items-center gap-2 font-mono text-xs bg-slate-50 w-fit px-2 py-1 rounded border border-slate-200"><FileText size={12}/> ICE: {client.ice}</div>}
                                {client.city && <div className="flex items-center gap-2"><MapPin size={14}/> {client.city}</div>}
                                {client.phone && <div className="flex items-center gap-2"><Phone size={14}/> {client.phone}</div>}
                            </div>

                            <div className="pt-2 flex justify-between items-center bg-slate-50/50 -mx-6 -mb-6 px-6 py-3 mt-auto">
                                <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm">
                                    <History size={14}/> Dossier Légal
                                </button>
                                {isAdmin && (
                                    <div className="flex gap-1">
                                        <button onClick={(e) => handleEdit(client, e)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit size={16}/></button>
                                        <button onClick={(e) => handleDelete(client.id, e)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* EDIT FORM */}
            {showForm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-black text-slate-800 text-lg">{editingId ? 'Modifier' : 'Nouveau Client'}</h3>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-200 rounded-full"><Users size={20}/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Nom</label><input required autoFocus type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label><input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-slate-500 uppercase">Ville</label><input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Adresse</label><textarea rows={2} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">ICE</label><input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm outline-none" value={formData.ice} onChange={e => setFormData({...formData, ice: e.target.value})} /></div>
                            <button className="w-full py-4 rounded-xl text-white font-bold shadow-lg mt-2 bg-blue-600 hover:bg-blue-700">Enregistrer</button>
                        </form>
                    </div>
                </div>
            )}

            {/* ✅ NEW: TRUE LEGAL PROFILE */}
            {selectedClientId && (
                <LegalClientProfile 
                    clientId={selectedClientId} 
                    onClose={() => setSelectedClientId(null)} 
                />
            )}
        </div>
    );
};