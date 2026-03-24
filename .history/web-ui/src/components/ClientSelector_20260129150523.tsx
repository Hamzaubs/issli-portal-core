import React, { useState, useEffect } from 'react';
import { Search, User, X, Check, Eye } from 'lucide-react';
import client from '../api/client';
import { ClientProfile } from './ClientProfile'; // ✅ IMPORT

interface Props {
    mode: 'INTERNAL' | 'LEGAL';
    onSelect: (client: any) => void;
    onClose: () => void;
}

export const ClientSelector: React.FC<Props> = ({ mode, onSelect, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [filtered, setFiltered] = useState<any[]>([]);
    
    // ✅ VIEW PROFILE FROM POS
    const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

    useEffect(() => {
        client.get(`/dashboard/clients?mode=${mode}`)
            .then(res => {
                setClients(res.data);
                setFiltered(res.data);
            })
            .catch(err => console.error(err));
    }, [mode]);

    useEffect(() => {
        if (!searchTerm) {
            setFiltered(clients);
        } else {
            const lower = searchTerm.toLowerCase();
            setFiltered(clients.filter(c => 
                c.name.toLowerCase().includes(lower) || 
                (c.phone && c.phone.includes(lower)) ||
                (c.ice && c.ice.includes(lower))
            ));
        }
    }, [searchTerm, clients]);

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <User size={20} className="text-blue-500"/> Sélectionner Client
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                </div>

                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                        <input autoFocus type="text" placeholder="Nom, Téléphone, ICE..." 
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {filtered.map(c => (
                        <div key={c.id} className="group p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors flex items-center justify-between border border-transparent hover:border-blue-100 mb-1">
                            <div className="flex-1" onClick={() => onSelect(c)}>
                                <div className="font-bold text-slate-800">{c.name}</div>
                                <div className="flex gap-2 text-xs mt-1">
                                    {c.phone && <span className="text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> {c.phone}</span>}
                                    {c.ice && <span className="text-indigo-400 font-mono bg-indigo-50 px-1 rounded">ICE: {c.ice}</span>}
                                </div>
                                {mode === 'INTERNAL' && Number(c.balance) > 0 && (
                                    <div className="mt-1 text-[10px] font-bold text-red-500">Dette: {Number(c.balance).toFixed(2)} DH</div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* ✅ VIEW PROFILE */}
                                <button onClick={(e) => { e.stopPropagation(); setViewingProfileId(c.id); }} className="p-2 bg-white text-slate-400 hover:text-blue-600 rounded-lg border border-slate-200 shadow-sm" title="Voir Historique">
                                    <Eye size={16}/>
                                </button>
                                <button onClick={() => onSelect(c)} className="p-2 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-200 hover:bg-blue-700">
                                    <Check size={16}/>
                                </button>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && <div className="text-center py-8 text-slate-400 italic">Aucun client trouvé.</div>}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 shadow-lg">+ Nouveau Client</button>
                </div>
            </div>

            {/* ✅ PROFILE MODAL ON TOP */}
            {viewingProfileId && <ClientProfile clientId={viewingProfileId} onClose={() => setViewingProfileId(null)} />}
        </div>
    );
};