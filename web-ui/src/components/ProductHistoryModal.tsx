// web-ui/src/components/ProductHistoryModal.tsx
import React, { useEffect, useState } from 'react';
import { X, History, ArrowUpRight, ArrowDownLeft, FileText, Activity, AlertTriangle } from 'lucide-react';
import client from '../api/client';

interface Props {
    productId: string;
    onClose: () => void;
}

export const ProductHistoryModal: React.FC<Props> = ({ productId, onClose }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.get(`/legal/products/${productId}/history`)
            .then(res => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [productId]);

    const formatNum = (n: number) => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(n);
    const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });

    if (!data && loading) return <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center"><div className="animate-spin text-white">Loading...</div></div>;
    if (!data) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* HEADER */}
                <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-blue-900 font-bold uppercase tracking-wider text-xs mb-2">
                            <Activity size={14}/> Audit Historique (Silo A)
                        </div>
                        <h2 className="text-2xl font-black text-slate-900">{data.product.name}</h2>
                        <div className="flex gap-4 mt-2 text-sm">
                            <span className="bg-slate-200 px-2 py-1 rounded text-slate-600 font-mono text-xs">{data.product.serialNumber}</span>
                            <span className="font-bold text-slate-700">Stock Actuel: <span className="text-blue-600 text-lg">{formatNum(data.product.quantity)}</span> {data.product.measureUnit}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X size={24}/></button>
                </div>

                {/* STATS BAR */}
                <div className="grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200">
                    <div className="bg-white p-4 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">Total Vendu</span>
                        <span className="font-black text-emerald-600 text-lg flex items-center gap-1"><ArrowUpRight size={16}/> {formatNum(data.stats.totalSold)}</span>
                    </div>
                    <div className="bg-white p-4 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">Total Retourné</span>
                        <span className="font-black text-rose-600 text-lg flex items-center gap-1"><ArrowDownLeft size={16}/> {formatNum(data.stats.totalReturned)}</span>
                    </div>
                </div>

                {/* TIMELINE TABLE */}
                <div className="flex-1 overflow-auto bg-slate-50 p-4">
                    <table className="w-full text-sm shadow-sm rounded-xl overflow-hidden">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-4 text-left">Date</th>
                                <th className="p-4 text-left">Document</th>
                                <th className="p-4 text-left">Client</th>
                                <th className="p-4 text-center">Mouvement</th>
                                <th className="p-4 text-right">Impact Stock</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {data.history.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Aucun mouvement enregistré.</td></tr>
                            ) : data.history.map((h: any) => (
                                <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-500 font-mono text-xs">{formatDate(h.date)}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 font-bold text-slate-700">
                                            {h.docType === 'FACTURE' ? <FileText size={14} className="text-blue-500"/> : 
                                             h.docType === 'AVOIR' ? <AlertTriangle size={14} className="text-rose-500"/> : <History size={14}/>}
                                            {h.docRef}
                                        </div>
                                        {h.status === 'ANNULEE' && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded ml-6">ANNULÉE</span>}
                                    </td>
                                    <td className="p-4 font-medium text-slate-600">{h.client}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            h.docType === 'AVOIR' ? 'bg-rose-100 text-rose-700' : 
                                            h.docType === 'FACTURE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {h.docType === 'AVOIR' ? 'RETOUR' : h.docType === 'FACTURE' ? 'VENTE' : h.docType}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-black font-mono text-base">
                                        {h.impact > 0 ? (
                                            <span className="text-rose-600">+{formatNum(h.impact)}</span>
                                        ) : h.impact < 0 ? (
                                            <span className="text-emerald-600">{formatNum(h.impact)}</span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-xs text-slate-400">
                    Traçabilité certifiée • ISSLI PECHE ERP
                </div>
            </div>
        </div>
    );
};