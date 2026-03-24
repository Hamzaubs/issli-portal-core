import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, X, Check, UserPlus, Loader } from 'lucide-react';
import client from '../api/client';

interface Props {
    mode: 'INTERNAL' | 'LEGAL';
    onSelect: (client: any) => void;
    onClose: () => void;
}

// Simple debounce to prevent API spam
function debounce(func: Function, wait: number) {
    let timeout: any;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export const ClientSelector: React.FC<Props> = ({ mode, onSelect, onClose }) => {
    const isInternal = mode === 'INTERNAL';
    
    // View State: 'LIST' or 'CREATE'
    const [view, setView] = useState<'LIST' | 'CREATE'>('LIST');
    
    // Data State
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Create Form State
    const [newClient, setNewClient] = useState({ name: '', phone: '', ice: '' });
    const [creating, setCreating] = useState(false);

    // 🔍 SEARCH LOGIC
    const searchClients = async (q: string) => {
        setLoading(true);
        try {
            if (isInternal) {
                // Use new Big Data Endpoint
                const res = await client.get(`/internal/clients?q=${q}&limit=10`);
                setClients(res.data.data || []);
            } else {
                // Use Legacy Endpoint for Legal (Silo A)
                const res = await client.get(`/dashboard/clients?mode=LEGAL&q=${q}`);
                setClients(Array.isArray(res.data) ? res.data : []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    const debouncedSearch = useCallback(debounce((q: string) => searchClients(q), 400), []);

    useEffect(() => {
        debouncedSearch(searchTerm);
    }, [searchTerm]);

    // 💾 CREATE LOGIC
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClient.name) return;
        
        setCreating(true);
        try {
            const endpoint = isInternal ? '/internal/clients' : '/dashboard/clients'; // Adjust based on your legal routes
            const res = await client.post(endpoint, newClient);
            
            // Auto-select the new client and close
            onSelect(res.data);
            onClose();
        } catch (err: any) {
            alert("Erreur création: " + (err.response?.data?.error || "Inconnue"));
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                
                {/* HEADER */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        {view === 'LIST' ? (
                            <><User size={20} className="text-blue-600"/> Sélectionner Client</>
                        ) : (
                            <><UserPlus size={20} className="text-emerald-600"/> Nouveau Client</>
                        )}
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                </div>

                {/* VIEW 1: SEARCH LIST */}
                {view === 'LIST' && (
                    <>
                        <div className="p-4 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input autoFocus type="text" placeholder="Rechercher (Nom, Tél, ICE)..." 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                            {loading ? (
                                <div className="flex justify-center items-center h-40 text-slate-400 gap-2"><Loader className="animate-spin" size={20}/> Recherche...</div>
                            ) : clients.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <p>Aucun résultat.</p>
                                    <p className="text-xs">Essayez un autre nom.</p>
                                </div>
                            ) : (
                                clients.map(c => (
                                    <div key={c.id} onClick={() => onSelect(c)} className="group p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors flex items-center justify-between border border-transparent hover:border-blue-100 mb-1">
                                        <div>
                                            <div className="font-bold text-slate-800">{c.name}</div>
                                            <div className="flex gap-2 text-xs mt-1">
                                                {c.phone && <span className="text-slate-500 font-mono">{c.phone}</span>}
                                                {c.ice && <span className="text-indigo-400 font-mono bg-indigo-50 px-1 rounded">ICE: {c.ice}</span>}
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600">
                                            <Check size={20}/>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                            <button onClick={() => setView('CREATE')} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 shadow-lg flex items-center justify-center gap-2 transition-all">
                                <UserPlus size={18}/> + Nouveau Client
                            </button>
                        </div>
                    </>
                )}

                {/* VIEW 2: CREATE FORM */}
                {view === 'CREATE' && (
                    <form onSubmit={handleCreate} className="flex-1 flex flex-col">
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Complet *</label>
                                <input autoFocus required type="text" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" 
                                    value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                                <input type="text" className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-500" 
                                    value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ICE (Optionnel)</label>
                                <input type="text" className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-emerald-500" 
                                    value={newClient.ice} onChange={e => setNewClient({...newClient, ice: e.target.value})} />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button type="button" onClick={() => setView('LIST')} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors">
                                Annuler
                            </button>
                            <button type="submit" disabled={creating} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg transition-all disabled:opacity-50">
                                {creating ? '...' : 'Enregistrer'}
                            </button>
                        </div>
                    </form>
                )}

            </div>
        </div>
    );
};