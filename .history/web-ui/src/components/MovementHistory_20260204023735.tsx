// web-ui/src/components/MovementHistory.tsx
import React, { useEffect, useState } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownLeft, RotateCcw, User, FileText, Banknote, CreditCard, Truck } from 'lucide-react';
import client from '../api/client';

interface Movement {
    id: string;
    type: 'SALE_CASH' | 'RETURN' | 'RESTOCK' | 'ADJUSTMENT' | 'QUOTE';
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
            const res = await client.get('/dashboard/history');
            setMovements(res.data);
        } catch (e) {
            console.error("History load error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchHistory(); }, []);

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
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    Historique Mouvements <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase tracking-wide">STOCK B</span>
                </h3>
                <button onClick={fetchHistory} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
            
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-100">
                        <tr>
                            <th className="p-4">Date</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Produit</th>
                            <th className="p-4">Client</th>
                            <th className="p-4">Paiement</th>
                            <th className="p-4 text-center">Quantité</th>
                            <th className="p-4 text-right">Montant Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chargement...</td></tr>
                        ) : movements.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">Aucun historique récent.</td></tr>
                        ) : (
                            movements.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="p-4 text-slate-500 font-mono text-xs">{new Date(m.date).toLocaleString('fr-MA')}</td>
                                    <td className="p-4">{getTypeBadge(m.type)}</td>
                                    <td className="p-4 font-bold text-slate-700">
                                        {m.productName}
                                        <span className="block text-[10px] text-slate-400 font-mono">{m.productSku}</span>
                                    </td>
                                    <td className="p-4 text-slate-600 font-bold">
                                        {m.clientName !== '-' ? (
                                            <span className="flex items-center gap-1.5 text-blue-900 bg-blue-50 px-2 py-1 rounded w-fit">
                                                <User size={12}/> {m.clientName}
                                            </span>
                                        ) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="p-4">{getPaymentBadge(m.paymentMethod)}</td>
                                    <td className="p-4 text-center font-black text-slate-800">
                                        {m.quantity} <span className="text-[10px] text-slate-400 font-normal uppercase">{m.measureUnit}</span>
                                    </td>
                                    <td className={`p-4 text-right font-bold ${m.type === 'RETURN' ? 'text-red-500' : 'text-slate-700'}`}>
                                        {m.amount !== 0 ? formatMAD(m.amount) : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};