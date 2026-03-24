// web-ui/src/components/ClientProfile.tsx
import React, { useEffect, useState } from 'react';
import { 
    X, User, Phone, MapPin, Calendar, CreditCard, 
    ArrowUpRight, RotateCcw, FileText, Printer, ShieldAlert,
    ChevronDown, History, ShoppingCart, Loader2, Banknote, CheckCircle, Link as LinkIcon
} from 'lucide-react';
import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';
// REMOVED: QuotePrinter import
import { ClientStatement } from './ClientStatement';

interface Props {
    clientId: string;
    onClose: () => void;
}

export const ClientProfile: React.FC<Props> = ({ clientId, onClose }) => {
    // Data & UI States
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination & Filter
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filterType, setFilterType] = useState('');
    const [totalPages, setTotalPages] = useState(1);

    // Modals
    const [showStatement, setShowStatement] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false); 
    const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', ref: '', note: '' });
    const [processingPayment, setProcessingPayment] = useState(false);
    
    // Payment Logic
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    // Print Data
    const [printTicketData, setPrintTicketData] = useState<any>(null);

    // --- LOAD DATA ---
    const loadProfile = async () => {
        try {
            const res = await client.get(`/internal/clients/${clientId}/details`);
            setProfile(res.data.profile);
            setStats(res.data.stats);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const loadHistory = async (pageNum: number, reset = false) => {
        if (pageNum === 1 && !reset) setLoading(true); 
        else if (pageNum > 1) setLoadingMore(true);

        try {
            const res = await client.get(`/internal/clients/${clientId}/history?page=${pageNum}&limit=15&type=${filterType}`);
            if (reset) {
                setHistory(res.data.data);
            } else {
                setHistory(prev => [...prev, ...res.data.data]);
            }
            setTotalPages(res.data.meta.pages);
            setPage(pageNum);
        } catch (e) { console.error(e); } finally { setLoading(false); setLoadingMore(false); }
    };

    useEffect(() => { 
        loadProfile(); 
        loadHistory(1, true); 
    }, [clientId]); 

    useEffect(() => {
        loadHistory(1, true);
    }, [filterType]);

    // --- HANDLERS ---
    const handleFilterChange = (newType: string) => {
        setFilterType(newType);
    };

    const handlePrint = (m: any) => {
        // Use InternalDeliveryNote for all internal movements (including Quotes/Estimates)
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
            isReturn: m.type === 'RETURN',
            // If it's a Quote, we might add a flag or just print it as a non-fiscal ticket
            isQuote: m.type === 'QUOTE'
        });
    };

    // --- PAYMENT LOGIC ---
    const handleSelectInvoice = (invoice: any) => {
        if (selectedInvoice?.id === invoice.id) {
            setSelectedInvoice(null);
            setPaymentForm(prev => ({ ...prev, amount: '', note: '' }));
        } else {
            setSelectedInvoice(invoice);
            setPaymentForm(prev => ({ 
                ...prev, 
                amount: invoice.amount.toString(),
                note: `Règlement Vente #${invoice.id.substring(0,8)}`
            }));
        }
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingPayment(true);
        try {
            await client.post(`/internal/clients/${clientId}/payment`, paymentForm);
            alert("✅ Paiement enregistré avec succès !");
            setShowPaymentModal(false);
            setPaymentForm({ amount: '', method: 'CASH', ref: '', note: '' });
            setSelectedInvoice(null);
            loadProfile();
            loadHistory(1, true);
        } catch (e: any) {
            alert("Erreur: " + (e.response?.data?.error || "Echec paiement"));
        } finally {
            setProcessingPayment(false);
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    const recentDebts = history.filter(h => (h.type === 'SALE_CASH' || h.type === 'SALE_CREDIT') && h.amount > 0).slice(0, 5);

    if (loading && !profile) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm text-white font-bold"><Loader2 className="animate-spin mr-2"/> Chargement...</div>;

    if (showStatement) return <ClientStatement clientId={clientId} onClose={() => setShowStatement(false)} />;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-100 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 relative">
                
                {/* HEADER */}
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
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full"><X size={24}/></button>
                </div>

                {/* STATS BAR */}
                <div className="grid grid-cols-3 gap-px bg-slate-200 border-b border-slate-200 shrink-0">
                    
                    {/* BOX 1: Debt + Payment Button */}
                    <div className="bg-white p-4 flex justify-between items-center relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Solde Actuel (Dette)</p>
                            <p className={`text-2xl font-black ${profile?.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formatMAD(profile?.balance || 0)}
                            </p>
                        </div>
                        <button onClick={() => setShowPaymentModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2 text-sm transition-all transform hover:scale-105 active:scale-95 z-10">
                            <Banknote size={16}/> Encaisser
                        </button>
                        {profile?.balance > 0 && <div className="absolute right-0 top-0 w-16 h-full bg-red-50 -skew-x-12 opacity-50 pointer-events-none"></div>}
                    </div>

                    {/* BOX 2: Volume */}
                    <div className="bg-white p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Volume Global</p>
                        <p className="text-xl font-black text-slate-800">{formatMAD(stats?.totalSpent || 0)}</p>
                    </div>

                    {/* BOX 3: Last Activity + Statement Button */}
                    <div className="bg-white p-4 flex items-center justify-between">
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Dernière Activité</p>
                            <p className="text-sm font-bold text-slate-700">{stats?.lastPurchase ? new Date(stats.lastPurchase).toLocaleDateString('fr-MA') : '-'}</p>
                         </div>
                         <button onClick={() => setShowStatement(true)} className="px-3 py-2 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm">
                            <Printer size={14}/> Relevé
                         </button>
                    </div>
                </div>

                {/* FILTER TOOLBAR */}
                <div className="p-4 flex justify-between items-center border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                    <div className="flex gap-2">
                        <button onClick={() => handleFilterChange('')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === '' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>Tout</button>
                        <button onClick={() => handleFilterChange('SALE_CASH')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'SALE_CASH' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50'}`}>Ventes</button>
                        <button onClick={() => handleFilterChange('QUOTE')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'QUOTE' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50'}`}>Devis</button>
                        <button onClick={() => handleFilterChange('RETURN')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'RETURN' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-red-50'}`}>Retours</button>
                        <button onClick={() => handleFilterChange('PAYMENT')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'PAYMENT' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50'}`}>Paiements</button>
                    </div>
                </div>

                {/* HISTORY LIST */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 custom-scrollbar">
                     {history.length === 0 && !loadingMore ? (
                        <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                            <History size={48} className="mb-2 opacity-20"/>
                            <p>Aucun historique disponible.</p>
                        </div>
                     ) : history.map((m, idx) => (
                        <div key={`${m.id}-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    m.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-600' : 
                                    m.type === 'RETURN' ? 'bg-red-100 text-red-600' : 
                                    m.type === 'QUOTE' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {m.type === 'PAYMENT' ? <CheckCircle size={20}/> : 
                                     m.type === 'RETURN' ? <RotateCcw size={20}/> : 
                                     m.type === 'QUOTE' ? <FileText size={20}/> : <ShoppingCart size={20}/>}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {m.type === 'PAYMENT' ? 'Encaissement' : 
                                         m.type === 'RETURN' ? `Retour: ${m.productName}` : m.productName}
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                                        <span>{new Date(m.date).toLocaleDateString('fr-MA')}</span>
                                        {m.paymentRef && <span>• Ref: {m.paymentRef}</span>}
                                        {m.type !== 'PAYMENT' && <span>• Qté: {m.quantity}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                                <div className={`font-black ${m.type === 'PAYMENT' || m.type === 'RETURN' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    {formatMAD(m.amount)}
                                </div>
                                <button onClick={() => handlePrint(m)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Réimprimer">
                                    <Printer size={18}/>
                                </button>
                            </div>
                        </div>
                     ))}
                     
                     {page < totalPages && (
                        <button onClick={() => loadHistory(page + 1)} disabled={loadingMore} className="w-full py-3 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-colors flex justify-center items-center gap-2 mt-4">
                            {loadingMore ? <Loader2 className="animate-spin" size={16}/> : <><ChevronDown size={18}/> Voir plus</>}
                        </button>
                     )}
                </div>

                {/* PAYMENT MODAL */}
                {showPaymentModal && (
                    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Nouveau Règlement</h3>
                                    <p className="text-xs text-slate-500">Sélectionnez une vente ou saisissez un montant</p>
                                </div>
                                <button onClick={() => setShowPaymentModal(false)}><X size={24} className="text-slate-400"/></button>
                            </div>

                            {/* Recent Debts Selector */}
                            {recentDebts.length > 0 && (
                                <div className="mb-6">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ventes récentes impayées (Suggestions)</p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {recentDebts.map(debt => (
                                            <div key={debt.id} onClick={() => handleSelectInvoice(debt)} 
                                                className={`p-3 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${selectedInvoice?.id === debt.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-slate-300'}`}>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-xs">{debt.productName}</p>
                                                    <p className="text-[10px] text-slate-400">{new Date(debt.date).toLocaleDateString('fr-MA')} • Réf: {debt.id.substring(0,8)}</p>
                                                </div>
                                                <div className="font-black text-slate-900">{formatMAD(debt.amount)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handlePaymentSubmit} className="space-y-4 border-t border-slate-100 pt-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Montant (DH)</label>
                                    <input autoFocus type="number" step="0.01" required className="w-full p-3 border-2 border-slate-200 rounded-xl text-3xl font-black text-emerald-600 outline-none focus:border-emerald-500"
                                        value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Mode</label>
                                        <select className="w-full p-3 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                            value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}>
                                            <option value="CASH">Espèces</option>
                                            <option value="CHECK">Chèque</option>
                                            <option value="TRANSFER">Virement</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Référence (Ex: Chèque N°)</label>
                                        <input type="text" className="w-full p-3 border border-slate-200 rounded-xl font-bold outline-none"
                                            placeholder="Optionnel"
                                            value={paymentForm.ref} onChange={e => setPaymentForm({...paymentForm, ref: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Note / Libellé</label>
                                    <input type="text" className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none"
                                        placeholder="Ex: Acompte, Solde total..."
                                        value={paymentForm.note} onChange={e => setPaymentForm({...paymentForm, note: e.target.value})} />
                                </div>

                                <button disabled={processingPayment} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg mt-2 flex justify-center items-center gap-2">
                                    {processingPayment ? <Loader2 className="animate-spin"/> : <CheckCircle size={20}/>}
                                    {processingPayment ? 'Enregistrement...' : 'Valider le Paiement'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* PRINT MODALS */}
                {printTicketData && <InternalDeliveryNote data={printTicketData} onClose={() => setPrintTicketData(null)} />}

            </div>
        </div>
    );
};