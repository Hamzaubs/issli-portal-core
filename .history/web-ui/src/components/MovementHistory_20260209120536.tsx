import React, { useEffect, useState } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, RotateCcw, User, FileText, Banknote, CreditCard, Truck, CheckCircle } from 'lucide-react';
import client from '../api/client';

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
}

export const MovementHistory = () => {
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // ✅ Connects to the new Safe Route
            const res = await client.get('/internal/transactions');
            setMovements(res.data);
        } catch (e) { 
            console.error("History load error", e); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { fetchHistory(); }, []);

    // ✅ SAFE VOID ACTION (Preserved)
    const handleVoid = async (m: Movement) => {
        if (!window.confirm(`⚠️ ANNULATION SÉCURISÉE\n\nVoulez-vous vraiment annuler ce mouvement ?\n\nProduit : ${m.productName}\nQuantité : ${m.quantity}\n\nCela va générer une contre-passation automatique.`)) return;
        try {
            await client.post(`/internal/transactions/${m.id}/void`);
            alert("✅ Mouvement annulé.");
            fetchHistory();
        } catch (error: any) { 
            alert("Erreur: " + (error.response?.data?.error || "Impossible d'annuler")); 
        }
    };

    // ✅ NEW: SMART BATCH CONVERT (Devis -> Vente)
    const handleConvert = async (m: Movement) => {
        if (!window.confirm(`⚡ CONVERSION DEVIS\n\nVoulez-vous transformer ce devis en VENTE FERME ?\nCela convertira TOUS les articles liés à ce devis et déduira le stock.`)) return;
        try {
            await client.post(`/internal/transactions/convert`, { quoteId: m.id, paymentMethod: 'CASH' });
            alert("✅ Devis converti en vente avec succès !");
            fetchHistory();
        } catch (error: any) { 
            alert("Erreur: " + (error.response?.data?.error || "Erreur conversion")); 
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'SALE_CASH': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold uppercase"><ArrowUpRight size={12}/> Vente</span>;
            case 'RETURN': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold uppercase"><RotateCcw size={12}/> Retour</span>;
            case 'RESTOCK': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold uppercase"><ArrowDownLeft size={12}/> Arrivage</span>;
            case 'QUOTE': return <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-bold uppercase"><FileText size={12}/> Devis</span>;
            default: return <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs font-bold uppercase">{type}</span>;
        }
    };

    const getPaymentBadge = (method?: string) => {
        if (!method) return <span className="text-slate-300">-</span>;
        switch(method) {
            case 'CASH': return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100"><Banknote size={10}/> ESPÈCES</span>;
            case 'CREDIT': return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100"><CreditCard size={10}/> CRÉDIT</span>;
            case 'CHECK': return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"><FileText size={10}/> CHÈQUE</span>;
            case 'DELIVERY': return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100"><Truck size={10}/> LIVR.</span>;
            default: return <span className="text-[10px] font-bold text-slate-500">{method}</span>;
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    return (
        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">Historique Mouvements <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase tracking-wide">STOCK B</span></h3>
                <button onClick={fetchHistory} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-100">
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
                        {loading ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">Chargement...</td></tr> : 
                         movements.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">Aucun historique récent.</td></tr> :
                         movements.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="p-4 text-slate-500 font-mono text-xs">{new Date(m.date).toLocaleString('fr-MA')}<div className="text-[10px] text-slate-300 mt-1">{m.id.substring(0,8)}</div></td>
                                <td className="p-4">{getTypeBadge(m.type)}</td>
                                <td className="p-4 font-bold text-slate-700">{m.productName}<span className="block text-[10px] text-slate-400 font-mono">{m.productSku}</span></td>
                                <td className="p-4 text-slate-600 font-bold">{m.clientName !== '-' ? <span className="flex items-center gap-1.5 text-blue-900 bg-blue-50 px-2 py-1 rounded w-fit text-xs"><User size={12}/> {m.clientName}</span> : '-'}</td>
                                <td className="p-4">{getPaymentBadge(m.paymentMethod)}</td>
                                <td className="p-4 text-center font-black text-slate-800">{m.quantity} <span className="text-[10px] text-slate-400 font-normal uppercase">{m.measureUnit}</span></td>
                                <td className={`p-4 text-right font-bold ${m.type === 'RETURN' || m.amount < 0 ? 'text-red-500' : 'text-slate-700'}`}>{m.amount !== 0 ? formatMAD(m.amount) : '-'}</td>
                                <td className="p-4 text-right">
                                    {m.type === 'QUOTE' ? (
                                        <button onClick={() => handleConvert(m)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-all text-xs font-bold flex items-center gap-1 ml-auto" title="Convertir en Vente">
                                            <CheckCircle size={12}/> CONVERTIR
                                        </button>
                                    ) : !m.productName.includes('ANNULATION') && (
                                        <button onClick={() => handleVoid(m)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-all text-xs font-bold flex items-center gap-1 ml-auto" title="Annuler">
                                            <RotateCcw size={12}/> ANNULER
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};