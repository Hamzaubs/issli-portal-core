import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, MapPin, Phone } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import client from '../api/client';

interface Props {
    clientId: string;
    onClose: () => void;
}

export const ClientStatement: React.FC<Props> = ({ clientId, onClose }) => {
    const [data, setData] = useState<any>(null);
    const componentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        client.get(`/dashboard/clients/${clientId}/statement`).then(res => setData(res.data)).catch(err => console.error(err));
    }, [clientId]);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: data ? `Releve_${data.client.name}` : 'Releve_Compte'
    });

    if (!data) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-white font-bold">Chargement du relevé...</div>;

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
            {/* Controls */}
            <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                <button onClick={() => handlePrint && handlePrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 transition-all">
                    <Printer size={18}/> Imprimer Relevé
                </button>
                <button onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white p-2 rounded-full shadow-lg transition-all">
                    <X size={24}/>
                </button>
            </div>

            {/* PREVIEW */}
            <div className="overflow-auto max-h-[90vh] rounded-lg shadow-2xl">
                <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] text-slate-900 mx-auto">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Relevé de Compte</h1>
                            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">Situation Client</p>
                        </div>
                        <div className="text-right text-xs space-y-1.5 text-slate-600">
                            <h3 className="font-black text-sm text-slate-900 uppercase">ISSLI PECHE S.A.R.L</h3>
                            <p className="flex items-center justify-end gap-2"><MapPin size={12}/> 19, Rue Bni Aamir, Casablanca</p>
                            <p className="flex items-center justify-end gap-2"><Phone size={12}/> +212 5 22 00 00 00</p>
                            <div className="mt-2 font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                                Date: {new Date().toLocaleDateString('fr-MA')}
                            </div>
                        </div>
                    </div>

                    {/* Client Box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8 flex justify-between items-center shadow-sm">
                        <div>
                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">Client Partenaire</p>
                            <h2 className="text-2xl font-black text-slate-800">{data.client.name}</h2>
                            {data.client.phone && <p className="text-sm text-slate-600 mt-1 font-mono">{data.client.phone}</p>}
                        </div>
                        <div className="text-right">
                            <p className="text-xs uppercase font-bold text-slate-400 mb-1">Solde Actuel (Dette)</p>
                            <h2 className={`text-4xl font-black ${data.finalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formatMAD(data.finalBalance)}
                            </h2>
                        </div>
                    </div>

                    {/* Transaction Table */}
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white uppercase tracking-wider">
                                <th className="p-3 text-left rounded-tl-lg">Date</th>
                                <th className="p-3 text-left">Opération</th>
                                <th className="p-3 text-right">Débit (Vente)</th>
                                <th className="p-3 text-right">Crédit (Paiement)</th>
                                <th className="p-3 text-right rounded-tr-lg">Solde</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {data.statement.map((row: any, i: number) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="p-3 font-mono text-slate-500">{new Date(row.date).toLocaleDateString('fr-MA')}</td>
                                    <td className="p-3">
                                        <span className={`font-bold ${row.type === 'PAIEMENT' ? 'text-emerald-600' : 'text-slate-700'}`}>
                                            {row.type}
                                        </span>
                                        <div className="text-[10px] text-slate-400 italic mt-0.5">{row.ref}</div>
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-700 font-medium">
                                        {row.debit > 0 ? formatMAD(row.debit) : '-'}
                                    </td>
                                    <td className="p-3 text-right font-mono text-emerald-600 font-bold bg-emerald-50/50">
                                        {row.credit > 0 ? formatMAD(row.credit) : '-'}
                                    </td>
                                    <td className="p-3 text-right font-mono font-black bg-slate-100">
                                        {formatMAD(row.balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-4 border-slate-900">
                                <td colSpan={2} className="p-4 font-black uppercase text-right text-slate-500">Totaux Période</td>
                                <td className="p-4 text-right font-bold text-slate-900 border-r border-slate-200">
                                    {formatMAD(data.statement.reduce((a:any,b:any) => a + b.debit, 0))}
                                </td>
                                <td className="p-4 text-right font-bold text-emerald-600 border-r border-slate-200">
                                    {formatMAD(data.statement.reduce((a:any,b:any) => a + b.credit, 0))}
                                </td>
                                <td className="p-4 text-right font-black text-lg bg-slate-200 text-slate-900">
                                    {formatMAD(data.finalBalance)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Footer */}
                    <div className="mt-16 pt-8 border-t border-slate-200 flex justify-between items-end">
                        <div className="text-[10px] text-slate-400 leading-relaxed">
                            <p>Ce document est généré électroniquement et vaut justification de solde.</p>
                            <p>ISSLI PECHE - Équipements Marins & Industriels</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-bold uppercase mb-16 text-slate-300">Signature & Cachet</p>
                            <div className="w-48 border-b-2 border-slate-200"></div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};