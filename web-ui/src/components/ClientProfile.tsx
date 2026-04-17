// web-ui/src/components/ClientProfile.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { 
    X, Phone, Printer, ShieldAlert, PieChart, CheckCircle2,
    Loader2, Banknote, User, Wallet, RotateCcw, Trash2,
    ArrowUpRight, FileText, ChevronDown, ChevronUp, ShoppingCart, History, ArrowDownLeft
} from 'lucide-react';
import client from '../api/client';
import { ClientStatement } from './ClientStatement';
import { InternalDeliveryNote } from './InternalDeliveryNote';
import { PaymentReceipt } from './PaymentReceipt';
import { InternalLegacyDebtModal } from './InternalLegacyDebtModal';

interface Props {
    clientId: string;
    onClose: () => void;
}

const InternalPaymentModal: React.FC<{ 
    clientId: string, maxAmount: number, clientName: string, 
    targetTicket?: any, 
    onClose: () => void, onSuccess: () => void 
}> = ({ clientId, maxAmount, clientName, targetTicket, onClose, onSuccess }) => {
    
    // 🧮 STRICT CENT-MATH
    const ticketTotalCents = Math.round((targetTicket?.groupTotal ?? targetTicket?.amount ?? 0) * 100);
    const ticketReturnedCents = targetTicket?.groupReturnedCents ?? 
        Math.round(((Math.round((targetTicket?.amount || 0) * 100) / (targetTicket?.quantity || 1)) * (targetTicket?.returnedQuantity || 0)));
    const ticketPaidCents = Math.round((targetTicket?.groupPaid ?? targetTicket?.paid ?? 0) * 100);
    
    const ticketDue = (ticketTotalCents - ticketReturnedCents - ticketPaidCents) / 100;
    const defaultAmount = targetTicket ? Math.max(0, ticketDue) : maxAmount;
    
    const [amount, setAmount] = useState<number | string>(defaultAmount);
    const [method, setMethod] = useState('CASH');
    const [reference, setReference] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payAmount = Number(amount);
        if (payAmount <= 0) return alert("Le montant doit être supérieur à 0.");
        if (payAmount > maxAmount) return alert(`Impossible de payer plus que la dette globale actuelle (${maxAmount} MAD).`);
        
        setLoading(true);
        try {
            await client.post(`/internal/clients/${clientId}/payment`, { 
                amount: payAmount, 
                method, 
                ref: reference, 
                note: targetTicket ? `Règlement Ticket ${targetTicket.id.substring(0,8)}` : note,
                movementId: targetTicket ? targetTicket.realId || targetTicket.id : undefined 
            });
            alert("✅ Paiement enregistré avec succès.");
            onSuccess();
        } catch (err: any) {
            alert("Erreur: " + (err.response?.data?.error || "Erreur serveur"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Banknote className="text-emerald-600"/> Encaisser Dette</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="text-center mb-6">
                        {targetTicket ? (
                            <p className="text-xs font-bold text-slate-500 uppercase">Règlement du Ticket <br/><span className="text-emerald-700">#{targetTicket.id.substring(0,8)}</span></p>
                        ) : (
                            <p className="text-xs font-bold text-slate-500 uppercase">Dette globale de {clientName}</p>
                        )}
                        <p className="text-3xl font-black text-red-600 mt-1">{defaultAmount.toLocaleString('fr-MA')} <span className="text-sm">MAD</span></p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Montant à payer</label>
                        <input type="number" step="0.01" max={defaultAmount} required autoFocus className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xl text-slate-800 outline-none focus:border-emerald-500 text-center" 
                            value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Méthode</label>
                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"
                            value={method} onChange={e => { setMethod(e.target.value); setReference(''); }}>
                            <option value="CASH">Espèces</option>
                            <option value="CHECK">Chèque</option>
                            <option value="TRANSFER">Virement</option>
                        </select>
                    </div>

                    {(method === 'CHECK' || method === 'TRANSFER') && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Référence</label>
                            <input type="text" required placeholder="Numéro..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono outline-none focus:border-emerald-500" 
                                value={reference} onChange={e => setReference(e.target.value)} />
                        </div>
                    )}

                    <button disabled={loading} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4">
                        {loading ? <Loader2 className="animate-spin" size={20}/> : <><CheckCircle2 size={20}/> VALIDER PAIEMENT</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export const ClientProfile: React.FC<Props> = ({ clientId, onClose }) => {
    const currentUser = JSON.parse(localStorage.getItem('marine_user') || '{}');
    const isAdmin = currentUser.role === 'SUPER_ADMIN';

    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filterType, setFilterType] = useState('');
    const [totalPages, setTotalPages] = useState(1);

    const [showStatement, setShowStatement] = useState(false);
    const [selectedDebtTicket, setSelectedDebtTicket] = useState<any>(null); 
    
    const [printData, setPrintData] = useState<any>(null);
    const [paymentPrintData, setPaymentPrintData] = useState<any>(null);
    const [showLegacyDebtModal, setShowLegacyDebtModal] = useState(false);
    const [returnModal, setReturnModal] = useState<{isOpen: boolean, mov: any | null, qty: number}>({ 
        isOpen: false, mov: null, qty: 1 
    });

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
            const res = await client.get(`/internal/clients/${clientId}/history?page=${pageNum}&limit=30&type=${filterType}`);
            if (reset) { 
                setHistory(res.data.data); 
                setExpandedGroups(new Set());
            } else { 
                setHistory(prev => [...prev, ...res.data.data]); 
            }
            setTotalPages(res.data.meta.pages);
            setPage(pageNum);
        } catch (e) { console.error(e); } finally { setLoading(false); setLoadingMore(false); }
    };

    const handleDeleteClient = async () => {
        if (!window.confirm(`⚠️ SUPPRESSION DÉFINITIVE\n\nVoulez-vous vraiment supprimer le client "${profile?.name}" ?`)) return;
        try {
            await client.delete(`/internal/clients/${clientId}`);
            alert("✅ Client supprimé avec succès.");
            onClose(); 
        } catch (error: any) {
            alert("Erreur: " + (error.response?.data?.error || "Impossible de supprimer ce client (Dettes ou Historique Actif)."));
        }
    };

    useEffect(() => { loadProfile(); loadHistory(1, true); }, [clientId]); 
    useEffect(() => { loadHistory(1, true); }, [filterType]);

    // 🧮 STRICT CENT-MATH GROUPING ENGINE
    const groupedHistory = useMemo(() => {
        const groups = new Map();
        history.forEach(m => {
            const timeKey = new Date(m.date).toISOString().substring(0, 16); 
            const isGroupable = m.type === 'SALE' || m.type === 'SALE_CASH' || m.type === 'SALE_CREDIT' || m.type === 'DELIVERY';
            const key = isGroupable ? `${timeKey}-${m.type}` : m.id;

            const amountCents = Math.round(Number(m.amount || 0) * 100);
            const paidCents = Math.round(Number(m.paid || 0) * 100);
            const qty = Number(m.quantity || 1);
            const retQty = Number(m.returnedQuantity || 0);
            
            const returnedCents = Math.round((amountCents / qty) * retQty);

            if (!groups.has(key)) {
                groups.set(key, { 
                    ...m, 
                    id: key, 
                    realId: m.id,
                    isGroup: false, 
                    subItems: [m], 
                    groupTotalCents: amountCents,
                    groupPaidCents: paidCents,
                    groupReturnedCents: returnedCents,
                    groupTotal: amountCents / 100,
                    groupPaid: paidCents / 100,
                    groupReturnedValue: returnedCents / 100
                });
            } else {
                const existing = groups.get(key);
                existing.isGroup = true;
                existing.subItems.push(m);
                existing.groupTotalCents += amountCents;
                existing.groupPaidCents += paidCents;
                existing.groupReturnedCents += returnedCents;
                
                existing.groupTotal = existing.groupTotalCents / 100;
                existing.groupPaid = existing.groupPaidCents / 100;
                existing.groupReturnedValue = existing.groupReturnedCents / 100;
            }
        });
        return Array.from(groups.values());
    }, [history]);

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedGroups(newSet);
    };

    const handleSubmitReturn = async () => {
        if (!returnModal.mov) return;
        try {
            await client.post(`/internal/transactions/${returnModal.mov.realId || returnModal.mov.id}/void`, { returnQty: returnModal.qty });
            alert("✅ Retour enregistré avec succès.");
            setReturnModal({ isOpen: false, mov: null, qty: 1 });
            loadProfile(); loadHistory(1, true);
        } catch (error: any) { alert("Erreur: " + (error.response?.data?.error || "Erreur serveur")); }
    };

    const handlePrintGroup = (g: any) => {
        if (!g.isGroup) return handlePrint(g);
        const items = g.subItems.map((s: any) => ({
            productName: s.productName,
            sku: s.sku || s.id.substring(0,8),
            quantity: s.quantity || 0,
            measureUnit: s.measureUnit || '-',
            unitPrice: Math.round((Number(s.amount) * 100) / (s.quantity || 1)) / 100,
            total: Number(s.amount)
        }));
        setPrintData({
            id: `BL-${new Date(g.date).getTime().toString().slice(-6)}`,
            isQuote: g.type === 'QUOTE',
            isReturn: g.type === 'RETURN',
            date: new Date(g.date),
            clientName: profile?.name,
            items: items,
            total: g.groupTotal,
            paymentMethod: g.subItems[0]?.paymentMethod,
            paymentRef: g.subItems[0]?.paymentRef
        });
    };

    const handlePrint = (m: any) => {
        if (m.type === 'PAYMENT') {
            setPaymentPrintData({
                id: m.id, date: new Date(m.date), clientName: profile?.name || 'Client', amount: Math.abs(m.amount),
                method: m.paymentMethod || 'CASH', reference: m.paymentRef, note: m.productName, context: 'MAGASIN INTERNE' 
            });
            return;
        }
        setPrintData({
            id: m.id.substring(0, 8).toUpperCase(), productName: m.productName.replace('Vente - ', ''), 
            sku: m.sku, quantity: m.quantity, measureUnit: m.measureUnit, 
            unitPrice: Math.round((Math.abs(m.amount) * 100) / (m.quantity || 1)) / 100, 
            total: Math.abs(m.amount), date: new Date(m.date), clientName: profile?.name, 
            paymentMethod: m.paymentMethod, paymentRef: m.paymentRef, isReturn: m.type === 'RETURN', isQuote: m.type === 'QUOTE'
        });
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    // 🛡️ FULL FRENCH TRANSLATION BADGES
    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'SALE':
            case 'SALE_CASH': 
            case 'SALE_CREDIT': return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-emerald-100 flex items-center gap-1 w-fit"><ArrowUpRight size={10}/>Vente</span>;
            case 'RETURN': return <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-red-100 flex items-center gap-1 w-fit"><RotateCcw size={10}/>Retour</span>;
            case 'RESTOCK': return <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-100 flex items-center gap-1 w-fit"><ArrowDownLeft size={10}/>Arrivage</span>;
            case 'PAYMENT': return <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-purple-100 flex items-center gap-1 w-fit"><Banknote size={10}/>Paiement</span>;
            case 'QUOTE': return <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-amber-100 flex items-center gap-1 w-fit"><FileText size={10}/>Devis</span>;
            default: return <span>{type}</span>;
        }
    };

    const getDocumentTitle = (type: string) => {
        if (type === 'QUOTE') return 'Devis';
        if (type === 'RETURN') return "Bon d'Avoir";
        return 'Bon de Livraison';
    };

    if (loading && !profile) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm text-white font-bold"><Loader2 className="animate-spin mr-2"/> Chargement...</div>;
    
    if (showStatement) return <ClientStatement clientId={clientId} onClose={() => setShowStatement(false)} silo="internal" />;

    const activeDebt = Math.max(0, profile?.balance || 0);

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-100 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 relative">
                
                <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-start shrink-0">
                    <div className="flex gap-4">
                        <div className="w-16 h-16 bg-emerald-700 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-emerald-200"><User size={32}/></div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">{profile?.name}</h1>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                {profile?.phone && <span className="flex items-center gap-1"><Phone size={14}/> {profile.phone}</span>}
                                {profile?.ice && <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs font-mono border border-slate-200">ICE: {profile.ice}</span>}
                                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Client Stock Global</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button onClick={handleDeleteClient} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-full transition-colors" title="Supprimer Client">
                                <Trash2 size={24}/>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full"><X size={24}/></button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-slate-200 border-b border-slate-200 shrink-0">
                    <div className="bg-white p-6 flex flex-col justify-between group relative overflow-hidden col-span-2">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Wallet size={12}/> Créance Active </p>
                                <p className={`text-4xl font-black mt-2 ${activeDebt > 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatMAD(activeDebt)}</p>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => setSelectedDebtTicket("GLOBAL")} 
                                    disabled={activeDebt <= 0} 
                                    className={`px-4 py-2 rounded-xl transition-colors font-bold flex items-center justify-center gap-2 ${activeDebt > 0 ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                    <Banknote size={20}/> {activeDebt > 0 ? 'ENCAISSER' : 'À JOUR'}
                                </button>
                                
                                <button onClick={() => setShowLegacyDebtModal(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-200 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2">
                                    <History size={14}/> Importer Dette
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 flex flex-col justify-between">
                         <div className="mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Volume D'Achats</p>
                            <p className="text-xl font-black text-slate-800">{formatMAD(stats?.totalSpent || 0)}</p>
                         </div>
                         <button onClick={() => setShowStatement(true)} className="w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50 rounded-xl flex items-center justify-center text-slate-600 hover:text-emerald-700 font-bold uppercase text-xs gap-2 transition-all"><Printer size={16}/> Relevé</button>
                    </div>
                </div>

                <div className="bg-slate-50 p-3 border-b border-slate-200 flex gap-2 shrink-0">
                    <select className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="">Tous les mouvements</option>
                        <option value="SALE_CASH">Ventes / Achats</option>
                        <option value="RETURN">Retours</option>
                        <option value="PAYMENT">Paiements</option>
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100 custom-scrollbar pb-20">
                      {groupedHistory.map((g, idx) => {
                          const isExpanded = expandedGroups.has(g.id);
                          
                          const remainingCents = Math.max(0, g.groupTotalCents - g.groupReturnedCents - g.groupPaidCents);
                          const remaining = remainingCents / 100;
                          
                          const isPartial = g.groupPaidCents > 0 && remainingCents > 5;
                          const isFullyPaid = remainingCents <= 5;

                          const canReturnGroup = g.isGroup
                                ? g.subItems.some((s: any) => s.type !== 'RETURN' && s.quantity > (s.returnedQuantity || 0))
                                : (g.type !== 'RETURN' && g.quantity > (g.returnedQuantity || 0));

                          return (
                              <React.Fragment key={`${g.id}-${idx}`}>
                                  <div className="p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all cursor-pointer group bg-white border-slate-200 hover:border-emerald-300"
                                      onClick={() => g.isGroup && toggleExpand(g.id)}
                                  >
                                      <div className="flex items-center gap-4">
                                          <div>
                                              <div className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                                                  {g.isGroup && (isExpanded ? <ChevronUp size={16} className="text-emerald-500"/> : <ChevronDown size={16} className="text-slate-400"/>)}
                                                  {g.isGroup ? getDocumentTitle(g.type) : g.productName}
                                                  
                                                  {(g.type === 'SALE_CASH' || g.type === 'SALE_CREDIT' || g.type === 'SALE') && (
                                                      isFullyPaid ? (
                                                          <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1.5 rounded border border-emerald-200 font-bold uppercase flex items-center gap-1"><CheckCircle2 size={8}/> {g.groupReturnedCents > 0 ? 'Soldé (Avec Retour)' : 'Payé'}</span>
                                                      ) : isPartial ? (
                                                          <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 rounded border border-sky-200 font-bold uppercase flex items-center gap-1"><PieChart size={8}/> Reste {formatMAD(remaining)}</span>
                                                      ) : (
                                                          <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 rounded border border-orange-200 font-bold uppercase flex items-center gap-1"><ShieldAlert size={8}/> Impayé</span>
                                                      )
                                                  )}
                                                  
                                                  {g.isGroup && <span className="text-[9px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{g.subItems.length} Articles</span>}
                                                  
                                                  {!g.isGroup && (g.returnedQuantity > 0) && (
                                                       <span className="text-[9px] text-red-500 font-bold ml-1">(Ret: {g.returnedQuantity})</span>
                                                  )}
                                              </div>
                                              <div className="flex gap-2 items-center">
                                                  {getTypeBadge(g.type)}
                                                  {g.paymentMethod && (
                                                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase border border-slate-200">
                                                          {g.paymentMethod} {g.paymentRef && g.paymentRef !== g.id ? ` - ${g.paymentRef}` : ''}
                                                      </span>
                                                  )}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-mono mt-1.5">
                                                  {new Date(g.date).toLocaleString('fr-MA')} <span className="mx-1">•</span> Réf: {g.isGroup ? `BL-${g.date.substring(14,19).replace(':','')}` : (g.realId || g.id).substring(0,8)}
                                              </div>
                                          </div>
                                      </div>
                                      
                                      <div className="text-right flex items-center gap-4" onClick={e => e.stopPropagation()}>
                                          <div className={`font-black ${g.type === 'RETURN' || g.type === 'PAYMENT' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                              {g.type === 'RETURN' || g.type === 'PAYMENT' ? '+' : ''}{formatMAD(g.groupTotal)}
                                          </div>
                                          
                                          {(g.type === 'SALE_CASH' || g.type === 'SALE_CREDIT' || g.type === 'SALE') && remaining > 0.05 ? (
                                              <button onClick={() => setSelectedDebtTicket(g)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all hover:scale-105">
                                                  <Banknote size={14}/> {isPartial ? 'SOLDE' : 'PAYER'}
                                              </button>
                                          ) : (
                                              <div className="w-8"></div>
                                          )}

                                          <div className="flex gap-1">
                                              {g.type !== 'QUOTE' && (
                                                  <button onClick={() => handlePrintGroup(g)} className="p-1.5 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent">
                                                      <Printer size={16}/>
                                                  </button>
                                              )}
                                              
                                              {canReturnGroup && g.type !== 'PAYMENT' && (
                                                  <button onClick={() => g.isGroup ? toggleExpand(g.id) : setReturnModal({ isOpen: true, mov: g, qty: 1 })} 
                                                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                      <RotateCcw size={16}/>
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  </div>

                                  {g.isGroup && isExpanded && g.subItems.map((sub: any) => (
                                      <div key={sub.id} className="mx-4 p-3 bg-white border-l-4 border-l-emerald-400 border-b border-r border-slate-200 shadow-sm flex justify-between items-center">
                                          <div className="flex items-center gap-3">
                                              <div className="flex flex-col">
                                                  <span className="font-bold text-slate-700 text-xs">{sub.productName}</span>
                                                  <span className="text-[10px] text-slate-400 font-mono">
                                                      Qté: {sub.quantity} {sub.measureUnit} | Réf: {sub.id.substring(0,8)}
                                                      {sub.returnedQuantity > 0 && <span className="text-red-500 font-bold ml-2">(-{sub.returnedQuantity} Ret)</span>}
                                                  </span>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-4">
                                              <span className="font-bold text-slate-600 text-xs">{formatMAD(Number(sub.amount))}</span>
                                              {sub.type !== 'RETURN' && !sub.productName?.includes('ANNULATION') && (sub.quantity > (sub.returnedQuantity || 0)) && (
                                                  <button onClick={() => setReturnModal({ isOpen: true, mov: sub, qty: 1 })} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded flex items-center gap-1 hover:bg-red-100">
                                                      <RotateCcw size={10}/> Retourner
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </React.Fragment>
                          );
                      })}
                      
                      {page < totalPages && (
                          <button onClick={() => loadHistory(page + 1)} disabled={loadingMore} className="w-full py-3 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-colors flex justify-center items-center gap-2">
                              {loadingMore ? <Loader2 className="animate-spin" size={18}/> : <><ChevronDown size={18}/> Charger plus</>}
                          </button>
                      )}
                      
                      {history.length === 0 && !loading && (
                          <div className="text-center py-12 opacity-50">
                              <ShoppingCart size={48} className="mx-auto mb-3 text-slate-300"/>
                              <p className="text-sm font-bold text-slate-400">Aucun historique trouvé</p>
                          </div>
                      )}
                </div>

                {selectedDebtTicket && (
                    <InternalPaymentModal 
                        clientId={clientId} 
                        clientName={profile?.name || ''}
                        maxAmount={selectedDebtTicket === "GLOBAL" ? activeDebt : selectedDebtTicket.groupTotal - selectedDebtTicket.groupReturnedValue - selectedDebtTicket.groupPaid} 
                        targetTicket={selectedDebtTicket === "GLOBAL" ? undefined : selectedDebtTicket}
                        onClose={() => setSelectedDebtTicket(null)} 
                        onSuccess={() => { setSelectedDebtTicket(null); loadProfile(); loadHistory(1, true); }} 
                    />
                )}
                
                {returnModal.isOpen && returnModal.mov && (
                    <div className="fixed inset-0 z-[300] bg-slate-900/60 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                            <h2 className="text-xl font-black mb-4">Retourner Produit</h2>
                            <p className="text-sm text-slate-500 mb-6">{returnModal.mov.productName}</p>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantité Max: <span className="text-red-600">{returnModal.mov.quantity - (returnModal.mov.returnedQuantity || 0)}</span></label>
                            {/* 🛡️ SECURITY FIX: Enforce ceiling via HTML max attribute */}
                            <input 
                                type="number" min="1" 
                                max={returnModal.mov.quantity - (returnModal.mov.returnedQuantity || 0)} 
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-2xl font-black text-center mb-6 outline-none focus:border-red-400" 
                                value={returnModal.qty} 
                                onChange={e => {
                                    const val = Number(e.target.value);
                                    const maxAllowed = returnModal.mov.quantity - (returnModal.mov.returnedQuantity || 0);
                                    setReturnModal({...returnModal, qty: val > maxAllowed ? maxAllowed : val});
                                }} 
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setReturnModal({isOpen: false, mov: null, qty: 1})} className="flex-1 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl">Annuler</button>
                                <button onClick={handleSubmitReturn} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">CONFIRMER</button>
                            </div>
                        </div>
                    </div>
                )}

                {printData && <InternalDeliveryNote data={printData} onClose={() => setPrintData(null)} />}
                {paymentPrintData && <PaymentReceipt data={paymentPrintData} onClose={() => setPaymentPrintData(null)} />}

                {showLegacyDebtModal && (
                    <InternalLegacyDebtModal 
                        clientId={clientId} 
                        clientName={profile?.name || ''}
                        onClose={() => setShowLegacyDebtModal(false)} 
                        onSuccess={() => { setShowLegacyDebtModal(false); loadProfile(); loadHistory(1, true); }} 
                    />
                )}
            </div>
        </div>
    );
};