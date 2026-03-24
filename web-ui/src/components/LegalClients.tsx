// web-ui/src/components/LegalClients.tsx
import React, { useEffect, useState } from 'react';
import { 
    Users, Search, Plus, MapPin, Phone, 
    Loader2, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, FileText, Wallet, Building2
} from 'lucide-react';
import client from '../api/client';
import { ClientModal } from './ClientModal';
import { ClientProfile } from './ClientProfile';

interface Client {
    id: string;
    name: string;
    ice?: string;
    city?: string;
    phone?: string;
    debt?: number;        // Legal Debt (Silo A)
    credit?: number;      // Legal Credit (Silo A)
    totalVolume?: number;
}

export const LegalClients: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]); 
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);

    const fetchClients = async (pageToLoad = 1) => {
        setLoading(true);
        setError('');
        try {
            // Fetches from ClientsController.getClients (Silo A Focused)
            const res = await client.get(`/clients?page=${pageToLoad}&limit=12&search=${encodeURIComponent(search)}`);
            if (res.data && Array.isArray(res.data.data)) {
                setClients(res.data.data);
                setMeta(res.data.meta);
            } else {
                setClients([]); 
            }
        } catch (err) {
            console.error(err);
            setError("Impossible de charger la liste des clients.");
            setClients([]); 
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        const timer = setTimeout(() => fetchClients(1), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* HEADER (Legal Blue Theme) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-blue-950 flex items-center gap-3 tracking-tight">
                        <Building2 className="text-blue-700" size={32} /> 
                        CLIENTS & FACTURATION <span className="text-slate-300 font-light">|</span> <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-lg">SILO A</span>
                    </h1>
                    <p className="text-blue-900/60 text-sm mt-1 font-medium">Répertoire Officiel (Conformité DGI & Suivi Comptable).</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-blue-800 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95 border border-blue-900">
                    <Plus size={20} /> Nouveau Client Légal
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3 mb-6">
                    <AlertCircle size={20}/> <span className="font-bold">{error}</span>
                    <button onClick={() => fetchClients(meta.page)} className="underline text-sm ml-auto">Réessayer</button>
                </div>
            )}

            {/* SEARCH */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex items-center gap-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <Search className="text-slate-400" size={20}/>
                <input 
                    type="text" 
                    placeholder="Rechercher par Raison Sociale, ICE, Ville..." 
                    className="flex-1 outline-none font-bold text-slate-700 placeholder:font-normal" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                />
            </div>

            {/* GRID */}
            {loading && clients.length === 0 ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-900" size={40}/></div>
            ) : clients.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                    <Users size={32} className="mx-auto mb-4 text-slate-300"/>
                    <h3 className="text-lg font-bold text-slate-900">Aucun client trouvé</h3>
                    <p className="text-slate-400 text-sm mt-1 mb-4">Votre base de données légale est vide.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {clients.map(c => (
                            <div key={c.id} onClick={() => setSelectedClient(c.id)} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-50 transition-all group relative cursor-pointer overflow-hidden">
                                
                                {/* Background "Watermark" for Official Look */}
                                <div className="absolute right-0 top-0 opacity-[0.03] text-blue-900 transform translate-x-4 -translate-y-4">
                                    <Building2 size={120}/>
                                </div>

                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center font-black text-xl border border-slate-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        {(c.name || '?').substring(0,2).toUpperCase()}
                                    </div>
                                    
                                    {/* DEBT BADGE - Explicitly Labeled */}
                                    <div className="flex flex-col items-end gap-1">
                                        {(c.debt && c.debt > 0.5) ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Dette Légale</span>
                                                <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg text-sm font-black border border-red-100 flex items-center gap-1">
                                                    <AlertCircle size={14} /> -{formatMoney(c.debt)}
                                                </span>
                                            </div>
                                        ) : (!c.credit || c.credit < 0.5) && (
                                            <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-xs font-black border border-emerald-100 flex items-center gap-1">
                                                <CheckCircle size={12} /> À jour
                                            </span>
                                        )}

                                        {c.credit && c.credit > 0.5 && (
                                            <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded-lg text-xs font-black border border-purple-100 flex items-center gap-1">
                                                <Wallet size={12} /> +{formatMoney(c.credit)} (Avoir)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="font-bold text-lg text-slate-900 mb-1 truncate relative z-10" title={c.name}>{c.name || 'Inconnu'}</h3>
                                
                                <div className="space-y-2 mt-4 text-sm text-slate-500 mb-4 border-b border-slate-100 pb-4 relative z-10">
                                    {c.ice ? (
                                        <div className="flex items-center gap-2 font-mono text-xs bg-slate-50 w-fit px-2 py-1 rounded border border-slate-200">
                                            <FileText size={12} className="text-slate-400"/> ICE: {c.ice}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-orange-400 italic flex items-center gap-1"><AlertCircle size={10}/> ICE Manquant</div>
                                    )}
                                    
                                    {c.city && <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-400"/> {c.city}</div>}
                                    {c.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {c.phone}</div>}
                                </div>

                                <div className="flex justify-between items-center text-xs relative z-10">
                                    <span className="text-slate-400 font-bold uppercase">Volume Facturé</span>
                                    <span className="font-black text-slate-700">{formatMoney(c.totalVolume || 0)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {meta.totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 py-4">
                            <button onClick={() => fetchClients(meta.page - 1)} disabled={meta.page === 1} className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-all"><ChevronLeft size={20}/></button>
                            <span className="text-sm font-bold text-slate-600">Page {meta.page} sur {meta.totalPages}</span>
                            <button onClick={() => fetchClients(meta.page + 1)} disabled={meta.page === meta.totalPages} className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-all"><ChevronRight size={20}/></button>
                        </div>
                    )}
                </>
            )}

            {showModal && <ClientModal onClose={() => setShowModal(false)} onSuccess={() => fetchClients(1)} />}
            
            {/* The new Profile with Payment Modal is linked here */}
            {selectedClient && <ClientProfile clientId={selectedClient} onClose={() => setSelectedClient(null)} />}
        </div>
    );
};