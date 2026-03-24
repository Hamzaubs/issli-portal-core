// web-ui/src/components/MovementHistory.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { 
    RefreshCw, ArrowUpRight, ArrowDownLeft, RotateCcw, 
    User, FileText, Banknote, CreditCard, Truck, Printer, 
    Building2, Search, Calendar, ChevronLeft, ChevronRight, FilterX,
    Trash2
} from 'lucide-react';
import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';

interface Movement {
    id: string; 
    type: string; 
    productName: string; 
    productSku: string; 
    clientName: string;
    quantity: number; 
    measureUnit: string; 
    amount: number; 
    date: string; 
    paymentMethod?: string;
    paymentRef?: string;
}

export const MovementHistory = () => {
    // 🛡️ RBAC: Security Check
    const currentUser = JSON.parse(localStorage.getItem('marine_user') || '{}');
    const isAdmin = currentUser.role === 'SUPER_ADMIN';

    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(true);
    const [printTicketData, setPrintTicketData] = useState<any>(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const limit = 50; 

    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [returnModal, setReturnModal] = useState<{isOpen: boolean, mov: Movement | null, qty: number}>({ 
        isOpen: false, mov: null, qty: 1 
    });

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search }),
                ...(startDate && { startDate }),
                ...(endDate && { endDate })
            });

            const res = await client.get(`/internal/transactions?${params.toString()}`);
            setMovements(res.data.data);
            setTotalPages(res.data.meta.totalPages);
            setTotalRecords(res.data.meta.total);
        } catch (e) { 
            console.error("History error", e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setPage(1);
            fetchHistory();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [search, startDate, endDate]);

    useEffect(() => {
        fetchHistory();
    }, [page]);

    const resetFilters = () => {
        setSearch('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleSubmitReturn = async () => {
        if (!returnModal.mov) return;
        try {
            await client.post(`/internal/transactions/${returnModal.mov.id}/void`, { 
                returnQty: returnModal.qty 
            });
            alert("✅ Retour enregistré avec succès.");
            setReturnModal({ isOpen: false, mov: null, qty: 1 });
            fetchHistory();
        } catch (error: any) { 
            alert("Erreur: " + (error.response?.data?.error || "Erreur serveur")); 
        }
    };

    const handleDeleteDevis = async (m: Movement) => {
        if (!window.confirm(`Voulez-vous supprimer ce devis ? Il sera retiré du pipeline.`)) return;
        try {
            await client.post(`/internal/transactions/${m.id}/void`);
            fetchHistory();
        } catch (error: any) { 
            alert("Erreur suppression devis."); 
        }
    };

    const handlePrint = (m: Movement) => {
        setPrintTicketData({
            id: m.id.substring(0, 8).toUpperCase(),
            productName: m.productName,
            sku: m.productSku,
            quantity: m.quantity,
            measureUnit: m.measureUnit,
            unitPrice: Math.abs(m.amount / (m.quantity || 1)),
            total: Math.abs(m.amount),
            date: new Date(m.date),
            clientName: m.clientName,
            paymentMethod: m.type === 'QUOTE' ? 'DEVIS' : m.paymentMethod,
            paymentRef: m.paymentRef,
            isReturn: m.type === 'RETURN',
            isQuote: m.type === 'QUOTE'
        });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'SALE_CASH': 
            case 'SALE_CREDIT': 
                return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold uppercase"><ArrowUpRight size={12}/> Vente</span>;
            case 'RETURN': 
                return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold uppercase"><RotateCcw size={12}/> Retour</span>;
            case 'RESTOCK': 
                return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold uppercase"><ArrowDownLeft size={12}/> Arrivage</span>;
            case 'QUOTE': 
                return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-bold uppercase"><FileText size={12}/> Devis</span>;
            default: 
                return <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold uppercase">{type}</span>;
        }
    };

    const getPaymentBadge = (method?: string, ref?: string) => {
        if (!method) return <span className="text-slate-300">-</span>;
        switch(method) {
            case 'CASH': return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100"><Banknote size={10}/> ESPÈCES</span>;
            case 'CREDIT': return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100"><CreditCard size={10}/> CRÉDIT</span>;
            case 'CHECK': return <div className="flex flex-col"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"><FileText size={10}/> CHÈQUE</span><span className="text-[9px] text-blue-400 font-mono ml-1">{ref}</span></div>;
            case 'TRANSFER': return <div className="flex flex-col"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100"><Building2 size={10}/> VIREMENT</span><span className="text-[9px] text-indigo-400 font-mono ml-1">{ref}</span></div>;
            case 'DELIVERY': return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100"><Truck size={10}/> LIVR.</span>;
            default: return <span className="text-[10px] font-bold text-slate-500">{method}</span>;
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in relative">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50 shrink-0">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        Historique Mouvements 
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase tracking-wide">STOCK B</span>
                        <span className="ml-2 text-xs text-slate-400 font-normal">({totalRecords} enregistrements)</span>
                    </h3>
                    <button onClick={fetchHistory} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input 
                            type="text" 
                            placeholder="Rechercher (Réf, Client, Produit)..." 
                            className="w-full pl-10 p-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
                        <Calendar className="text-slate-400 ml-2" size={16}/>
                        <input 
                            type="date" 
                            className="p-1 text-sm outline-none bg-transparent text-slate-600"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-slate-300">-</span>
                        <input 
                            type="date" 
                            className="p-1 text-sm outline-none bg-transparent text-slate-600"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>

                    {(search || startDate || endDate) && (
                        <button onClick={resetFilters} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-1.5 rounded-lg border border-red-100 transition-colors">
                            <FilterX size={14}/> Effacer
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-100 shadow-sm">
                        <tr>
                            <th className="p-4">Date / Ref</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Produit</th>
                            <th className="p-4">Client</th>
                            <th className="p-4">Paiement</th>
                            <th className="p-4 text-center">Qté</th>
                            <th className="p-4 text-right">Montant</th>
                            <th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading && movements.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">Chargement...</td></tr> 
                        ) : movements.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-400">Aucun historique trouvé.</td></tr>
                        ) : (
                            movements.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="p-4 text-slate-500 font-mono text-xs">
                                        {new Date(m.date).toLocaleString('fr-MA')}
                                        <div className="text-[10px] text-slate-300 mt-1">{m.id.substring(0,8)}</div>
                                    </td>
                                    <td className="p-4">{getTypeBadge(m.type)}</td>
                                    <td className="p-4 font-bold text-slate-700">
                                        {m.productName}
                                        <span className="block text-[10px] text-slate-400 font-mono">{m.productSku}</span>
                                    </td>
                                    <td className="p-4 text-slate-600 font-bold">
                                        {m.clientName !== '-' ? <span className="flex items-center gap-1.5 text-blue-900 bg-blue-50 px-2 py-1 rounded w-fit text-xs"><User size={12}/> {m.clientName}</span> : '-'}
                                    </td>
                                    <td className="p-4">
                                        {m.type === 'QUOTE' ? <span className="text-[10px] font-bold text-amber-500">EN ATTENTE</span> : getPaymentBadge(m.paymentMethod, m.paymentRef)}
                                    </td>
                                    <td className="p-4 text-center font-black text-slate-800">
                                        {m.quantity} <span className="text-[10px] text-slate-400 font-normal uppercase">{m.measureUnit}</span>
                                    </td>
                                    <td className={`p-4 text-right font-bold ${m.type === 'RETURN' || m.amount < 0 ? 'text-red-500' : m.type === 'QUOTE' ? 'text-amber-600' : 'text-slate-700'}`}>
                                        {m.amount !== 0 ? formatMAD(m.amount) : '-'}
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handlePrint(m)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Imprimer Document">
                                            <Printer size={16}/>
                                        </button>
                                        
                                        {/* 🛡️ RBAC: Hide Voids from non-admins */}
                                        {!m.productName.includes('ANNULATION') && !m.productName.includes('RETOUR PARTIEL') && isAdmin && (
                                            m.type === 'QUOTE' ? (
                                                <button onClick={() => handleDeleteDevis(m)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Supprimer Devis">
                                                    <Trash2 size={16}/>
                                                </button>
                                            ) : (
                                                <button onClick={() => setReturnModal({ isOpen: true, mov: m, qty: 1 })} className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Faire un retour (Total ou Partiel)">
                                                    <RotateCcw size={16}/>
                                                </button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-400 font-medium">
                    Affichage {movements.length} sur {totalRecords}
                </span>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1 || loading}
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors">
                        <ChevronLeft size={16}/>
                    </button>
                    <span className="text-sm font-bold text-slate-700">
                        Page {page} <span className="text-slate-400 font-normal">/ {totalPages || 1}</span>
                    </span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                        disabled={page === totalPages || totalPages === 0 || loading}
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors">
                        <ChevronRight size={16}/>
                    </button>
                </div>
            </div>
            
            {returnModal.isOpen && returnModal.mov && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-800">Retour Marchandise</h2>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-xl mb-6 text-sm">
                            <p className="font-bold text-slate-700">{returnModal.mov.productName}</p>
                            <p className="text-slate-500">Acheté par: {returnModal.mov.clientName}</p>
                            <p className="text-slate-500">Quantité originale: <span className="font-bold text-slate-800">{returnModal.mov.quantity}</span></p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantité à retourner</label>
                            <input 
                                type="number" 
                                min="1" 
                                max={returnModal.mov.quantity} 
                                value={returnModal.qty} 
                                onChange={e => setReturnModal({...returnModal, qty: Number(e.target.value)})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setReturnModal({isOpen: false, mov: null, qty: 1})} 
                                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                                Annuler
                            </button>
                            <button 
                                onClick={handleSubmitReturn} 
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                                <RotateCcw size={18}/> Confirmer Retour
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {printTicketData && <InternalDeliveryNote data={printTicketData} onClose={() => setPrintTicketData(null)} />}
        </div>
    );
};