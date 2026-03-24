import React, { useEffect, useState } from 'react';
import { 
    X, User, Phone, MapPin, Calendar, CreditCard, 
    ArrowUpRight, RotateCcw, FileText, Printer, ShieldAlert,
    ChevronDown, History, ShoppingCart, Loader2
} from 'lucide-react';
import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';
import { QuotePrinter } from './QuotePrinter';
import { ClientStatement } from './ClientStatement'; // Ensure you have this file from previous steps

interface Props {
    clientId: string;
    onClose: () => void;
}

export const ClientProfile: React.FC<Props> = ({ clientId, onClose }) => {
    // 1. DATA STATES
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    
    // 2. UI STATES
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterType, setFilterType] = useState<string>(''); 

    // 3. PRINT STATES
    const [printTicketData, setPrintTicketData] = useState<any>(null);
    const [printQuoteData, setPrintQuoteData] = useState<any>(null);
    const [showStatement, setShowStatement] = useState(false);

    // --- LOAD PROFILE ---
    useEffect(() => {
        const loadProfile = async () => {
            try {
                // ✅ Use internal routes
                const res = await client.get(`/internal/clients/${clientId}/details`);
                setProfile(res.data.profile);
                setStats(res.data.stats);
                loadHistory(1, ''); 
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [clientId]);

    // --- LOAD HISTORY (Paginated) ---
    const loadHistory = async (pageNum: number, type: string) => {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        try {
            const url = `/internal/clients/${clientId}/history?page=${pageNum}&limit=15${type ? `&type=${type}` : ''}`;
            const res = await client.get(url);
            
            if (pageNum === 1) {
                setHistory(res.data.data);
            } else {
                setHistory(prev => [...prev, ...res.data.data]);
            }
            setTotalPages(res.data.meta.pages);
            setPage(pageNum);
        } catch (e) {
            console.error("History Error", e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // --- HANDLERS ---
    const handleFilterChange = (newType: string) => {
        setFilterType(newType);
        loadHistory(1, newType);
    };

    const handlePrint = (m: any) => {
        if (m.type === 'QUOTE') {
            setPrintQuoteData({
                items: [{ product: { name: m.productName, internalSku: m.sku, measureUnit: m.measureUnit }, qty: m.quantity, unitPrice: m.amount / m.quantity }],
                clientName: profile?.name
            });
        } else {
            setPrintTicketData({
                id: m.id.substring(0,8).toUpperCase(),
                date: m.date,
                productName: m.productName,
                sku: m.sku,
                quantity: m.quantity,
                measureUnit: m.measureUnit,
                total: m.amount,
                clientName: profile?.name,
                paymentMethod: m.paymentMethod,
                paymentRef: m.paymentRef,
                isReturn: m.type === 'RETURN'
            });
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    if (loading && !profile) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm text-white font-bold"><Loader2 className="animate-spin mr-2"/> Chargement du dossier...</div>;

    // ✅ STATEMENT OVERLAY
    if (showStatement) {
        return <ClientStatement clientId={clientId} onClose={() => setShowStatement(false)} />;
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-100 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
                
                {/* 1. HEADER PROFILE */}
                <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-start shrink-0">
                    <div className="flex gap-4">
                        <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg">
                            {profile?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">{profile?.name}</h1>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                {profile?.phone && <span className="flex items-center gap-1"><Phone size={14}/> {profile.phone}</span>}
                                {profile?.city && <span className="flex items-center gap-1"><MapPin size={14}/> {profile.city}</span>}
                                {profile?.ice && <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">ICE: {profile.ice}</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X size={24}/></button>
                </div>

                {/* 2. STATS BAR */}
                <div className="grid grid-cols-3 gap-px bg-slate-200 border-b border-slate-200 shrink-0">
                    <div className="bg-white p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Solde Actuel (Dette)</p>
                        <p className={`text-2xl font-black ${profile?.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMAD(profile?.balance || 0)}</p>
                    </div>
                    <div className="bg-white p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Volume d'Achat Global</p>
                        <p className="text-xl font-black text-slate-800">{formatMAD(stats?.totalSpent || 0)}</p>
                    </div>
                    <div className="bg-white p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Dernière Activité</p>
                        <p className="text-sm font-bold text-slate-700">{stats?.lastPurchase ? new Date(stats.lastPurchase).toLocaleDateString('fr-MA') : 'Jamais'}</p>
                    </div>
                </div>

                {/* 3. HISTORY FILTER & LIST */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
                    {/* Toolbar */}
                    <div className="p-4 flex justify-between items-center border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                        <div className="flex gap-2">
                            <button onClick={() => handleFilterChange('')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === '' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Tout</button>
                            <button onClick={() => handleFilterChange('SALE_CASH')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'SALE_CASH' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50'}`}>Ventes</button>
                            <button onClick={() => handleFilterChange('QUOTE')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'QUOTE' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50'}`}>Devis</button>
                            <button onClick={() => handleFilterChange('RETURN')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'RETURN' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-red-50'}`}>Retours</button>
                        </div>
                        <button onClick={() => setShowStatement(true)} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors bg-white px-3 py-1.5 rounded border border-slate-200 shadow-sm">
                            <Printer size={14}/> Imprimer Relevé
                        </button>
                    </div>

                    {/* Infinite Scroll List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {history.length === 0 && !loading ? (
                            <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                                <History size={48} className="mb-2 opacity-20"/>
                                <p>Aucun historique disponible pour ce filtre.</p>
                            </div>
                        ) : (
                            history.map((m, idx) => (
                                <div key={`${m.id}-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.type === 'RETURN' ? 'bg-red-50 text-red-600' : m.type === 'QUOTE' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {m.type === 'RETURN' ? <RotateCcw size={20}/> : m.type === 'QUOTE' ? <FileText size={20}/> : <ArrowUpRight size={20}/>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm">{m.productName}</div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5 flex gap-2">
                                                <span>{new Date(m.date).toLocaleDateString('fr-MA')}</span>
                                                <span className="text-slate-300">•</span>
                                                <span>Qté: {m.quantity} {m.measureUnit}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="text-right flex items-center gap-6">
                                        <div>
                                            <div className={`font-black text-lg ${m.type === 'RETURN' ? 'text-red-600' : m.type === 'QUOTE' ? 'text-amber-600' : 'text-slate-800'}`}>
                                                {formatMAD(m.amount)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{m.type === 'SALE_CASH' ? 'VENTE' : m.type}</div>
                                        </div>
                                        
                                        {/* Print Action */}
                                        <button onClick={() => handlePrint(m)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Réimprimer">
                                            <Printer size={18}/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                        
                        {/* Load More Button */}
                        {page < totalPages && (
                            <button onClick={() => loadHistory(page + 1, filterType)} disabled={loadingMore} className="w-full py-3 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-colors flex justify-center items-center gap-2">
                                {loadingMore ? <Loader2 className="animate-spin" size={16}/> : <><ChevronDown size={18}/> Voir plus d'historique</>}
                            </button>
                        )}
                    </div>
                </div>

                {/* PRINT MODALS (Reused) */}
                {printTicketData && <InternalDeliveryNote data={printTicketData} onClose={() => setPrintTicketData(null)} />}
                {printQuoteData && <QuotePrinter items={printQuoteData.items} clientName={printQuoteData.clientName} onClose={() => setPrintQuoteData(null)} />}

            </div>
        </div>
    );
};