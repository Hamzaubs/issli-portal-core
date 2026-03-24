import React, { useEffect, useState } from 'react';
import { 
    X, Phone, FileText, ShoppingCart, 
    CheckCircle, AlertCircle, Building, 
    CreditCard, ArrowDownLeft, Printer, Link as LinkIcon,
    Loader2, ChevronDown
} from 'lucide-react';
import client from '../api/client';
import { ClientStatement } from './ClientStatement';

interface Props {
    clientId: string;
    onClose: () => void;
}

export const ClientProfile: React.FC<Props> = ({ clientId, onClose }) => {
    // 1. Core Profile Data
    const [profileData, setProfileData] = useState<any>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    
    // 2. Infinite History Data
    const [history, setHistory] = useState<any[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [showStatement, setShowStatement] = useState(false);

    // --- INITIAL LOAD (Fast) ---
    useEffect(() => {
        setLoadingProfile(true);
        // Clear previous state if clientId changes
        setHistory([]);
        setCursor(null);
        setHasMore(true);

        // Fetch Profile Stats
        client.get(`/clients/${clientId}/global-details`)
            .then(res => {
                setProfileData(res.data);
                // Trigger first history load immediately after profile
                loadHistory(null);
            })
            .catch(err => console.error(err))
            .finally(() => setLoadingProfile(false));
    }, [clientId]);

    // --- HISTORY LOADER ---
    const loadHistory = async (currentCursor: string | null) => {
        setLoadingHistory(true);
        try {
            const query = currentCursor ? `?cursor=${currentCursor}&limit=10` : `?limit=10`;
            const res = await client.get(`/clients/${clientId}/history${query}`);
            
            const newItems = res.data.data;
            const nextCursor = res.data.nextCursor;

            if (newItems.length === 0) setHasMore(false);
            
            setHistory(prev => currentCursor ? [...prev, ...newItems] : newItems);
            setCursor(nextCursor);
            if (!nextCursor) setHasMore(false);

        } catch (err) {
            console.error("History Error", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    // --- RENDERERS ---
    if (loadingProfile) return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl animate-pulse flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="font-bold text-slate-600">Chargement du profil...</p>
            </div>
        </div>
    );

    if (!profileData) return null;

    const { profile, stats, matchFound, legalClient } = profileData;

    if (showStatement) {
        return <ClientStatement clientId={clientId} onClose={() => setShowStatement(false)} />;
    }

    return (
        <div className="fixed inset-0 z-[50] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-in slide-in-from-right duration-300">
            <div className="w-full max-w-2xl h-full bg-slate-50 shadow-2xl flex flex-col border-l border-slate-200">
                
                {/* HEADER */}
                <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-start shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-800">{profile.name}</h2>
                            {matchFound && (
                                <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700 flex items-center gap-1">
                                    <LinkIcon size={12}/> Lié (Silo A+B)
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                            {profile.phone && <span className="flex items-center gap-1"><Phone size={14}/> {profile.phone}</span>}
                            {(profile.ice || legalClient?.ice) && (
                                <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 rounded border border-indigo-100">
                                    <Building size={14}/> ICE: {profile.ice || legalClient?.ice}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"><X /></button>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-3 gap-1 p-4 bg-slate-100 shrink-0">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Dette Interne</p>
                        <p className={`text-xl font-black ${stats.currentDebt > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {formatMAD(stats.currentDebt)}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">Vol. Interne</p>
                        <p className="text-xl font-black text-blue-700">{formatMAD(stats.internalSpent)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-indigo-400 mb-1">Vol. Légal</p>
                        <p className="text-xl font-black text-indigo-700">{formatMAD(stats.legalInvoiced)}</p>
                    </div>
                </div>

                {/* ACTION BAR */}
                <div className="px-6 py-2 bg-white border-b border-slate-200 flex justify-end shrink-0">
                    <button onClick={() => setShowStatement(true)} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
                        <Printer size={16}/> Imprimer Relevé Compte
                    </button>
                </div>

                {/* INFINITE SCROLL TIMELINE */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-6">Historique Unifié (Chronologique)</h3>
                    
                    <div className="space-y-6 relative">
                        <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-slate-200"></div>

                        {history.length === 0 && !loadingHistory ? (
                            <p className="text-center text-slate-400 italic py-10">Aucun historique disponible.</p>
                        ) : (
                            history.map((item: any, idx: number) => {
                                // Determine Icon/Color based on Source/Type
                                let icon = <ShoppingCart size={16}/>;
                                let color = 'blue';
                                let label = item.type;

                                if (item.source === 'LEGAL') {
                                    icon = <FileText size={16}/>;
                                    color = 'indigo';
                                    label = item.type === 'AVOIR' ? `Avoir #${item.ref}` : `Facture #${item.ref}`;
                                } else if (item.source === 'PAYMENT') {
                                    icon = <CreditCard size={16}/>;
                                    color = 'emerald';
                                    label = `Paiement (${item.ref})`;
                                } else if (item.type === 'RETOUR') {
                                    icon = <ArrowDownLeft size={16}/>;
                                    color = 'red';
                                    label = 'Retour Stock';
                                } else {
                                    label = `Vente: ${item.ref}`;
                                }

                                return (
                                    <div key={`${item.source}-${item.id}-${idx}`} className="relative flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        {/* ICON */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-slate-50 shadow-sm bg-${color}-100 text-${color}-600`}>
                                            {icon}
                                        </div>

                                        {/* CARD */}
                                        <div className={`flex-1 p-4 rounded-xl border shadow-sm transition-all hover:shadow-md ${item.source === 'LEGAL' ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white border-slate-200'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <div>
                                                    <h4 className={`font-bold text-sm ${item.source === 'LEGAL' ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                        {label}
                                                    </h4>
                                                    <p className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString('fr-MA')} • {new Date(item.date).toLocaleTimeString('fr-MA').slice(0,5)}</p>
                                                </div>
                                                <span className={`font-mono font-bold ${item.amount < 0 || item.source === 'PAYMENT' ? 'text-emerald-600' : item.source === 'LEGAL' ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                    {formatMAD(item.amount)}
                                                </span>
                                            </div>
                                            
                                            {item.note && <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-1 rounded">Note: {item.note}</p>}
                                            
                                            {item.source === 'LEGAL' && (
                                                <div className="mt-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-${item.status === 'PAYEE' ? 'emerald' : 'amber'}-50 text-${item.status === 'PAYEE' ? 'emerald' : 'amber'}-700 border-${item.status === 'PAYEE' ? 'emerald' : 'amber'}-200`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* LOAD MORE BUTTON */}
                        {hasMore && (
                            <div className="flex justify-center pt-4 pb-8 relative z-20">
                                <button 
                                    onClick={() => loadHistory(cursor)} 
                                    disabled={loadingHistory}
                                    className="flex items-center gap-2 px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    {loadingHistory ? <Loader2 className="animate-spin" size={16}/> : <ChevronDown size={16}/>}
                                    {loadingHistory ? 'Chargement...' : 'Charger plus ancien'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};