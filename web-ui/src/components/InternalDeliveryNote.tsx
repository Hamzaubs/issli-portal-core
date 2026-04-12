import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, MapPin, Phone, FileText, ArrowLeftRight, AlertCircle, Package } from 'lucide-react';

interface Props {
    data: any;
    onClose: () => void;
}

export const InternalDeliveryNote: React.FC<Props> = ({ data, onClose }) => {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `${data.isQuote ? 'DEVIS' : data.isReturn ? 'AVOIR' : 'BL'}_${data.id}`,
        onAfterPrint: onClose,
    });

    const formatMAD = (amount: number) => 
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Math.abs(amount));

    const getUnitLabel = (unit?: string) => { 
        switch(unit) { 
            case 'M': return 'm'; 
            case 'KG': return 'kg'; 
            case 'L': return 'L'; 
            case 'UNIT': default: return 'u'; 
        } 
    };

    const docType = data.isQuote ? 'DEVIS' : data.isReturn ? 'BON DE RETOUR' : 'BON DE LIVRAISON';
    const totalLabel = data.isQuote ? 'Total Estimé' : data.isReturn ? 'Total Avoir' : 'Total Net à Payer';
    const themeColor = data.isReturn ? 'text-red-700' : data.isQuote ? 'text-amber-700' : 'text-emerald-900';
    const borderColor = data.isReturn ? 'border-red-900' : data.isQuote ? 'border-amber-900' : 'border-slate-900';

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in overflow-y-auto">
            
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>

            <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
                <button onClick={() => handlePrint()} className="bg-emerald-700 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-emerald-800 flex items-center gap-2 transition-all">
                    <Printer size={18}/> Imprimer
                </button>
                <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
                    <X size={24}/>
                </button>
            </div>

            <div className="my-4 print:my-0 w-full flex justify-center">
                <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] text-slate-900 shadow-2xl print:shadow-none relative flex flex-col">
                    
                    <div className={`flex justify-between items-start border-b-2 ${borderColor} pb-6 mb-8`}>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter text-emerald-800 leading-none">ISSLI PECHE</h1>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="h-1.5 w-10 bg-emerald-600 rounded-full"></div>
                                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Magasin (Silo B)</span>
                            </div>
                            <div className="text-xs text-slate-500 space-y-1 mt-4 border-l-2 border-slate-100 pl-2">
                                <p className="flex items-center gap-2"><MapPin size={12}/> 19, Rue Bni Aamir, Bourgogne, Casablanca</p>
                                <p className="flex items-center gap-2"><Phone size={12}/> +212 5 22 20 51 96</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className={`text-3xl font-black uppercase mb-1 tracking-tighter ${themeColor}`}>{docType}</h2>
                            <p className="text-sm font-bold text-slate-500">Réf: {data.id}</p>
                            <p className="text-xs font-bold text-slate-400 mt-2">{new Date(data.date).toLocaleDateString('fr-MA')}</p>
                        </div>
                    </div>

                    <div className="flex justify-end mb-10">
                        <div className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Client</p>
                            <h3 className="text-lg font-black text-slate-900">{data.clientName || 'CLIENT COMPTOIR'}</h3>
                        </div>
                    </div>

                    <div className="flex-1">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-900 uppercase text-[10px] font-bold tracking-widest border-y border-slate-200">
                                    <th className="p-3 text-left">Article</th>
                                    <th className="p-3 text-center">Qté</th>
                                    <th className="p-3 text-right">P.U. (DH)</th>
                                    <th className="p-3 text-right">Sous-Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.items.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-800">{item.productName}</div>
                                            <div className="text-[9px] text-slate-400 font-mono">Ref: {item.sku || '-'}</div>
                                        </td>
                                        <td className="p-3 text-center font-bold">{item.quantity} {getUnitLabel(item.measureUnit)}</td>
                                        <td className="p-3 text-right text-slate-600 font-mono">{formatMAD(item.unitPrice)}</td>
                                        <td className="p-3 text-right font-black text-slate-900">{formatMAD(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-8">
                        <div className={`flex justify-end border-t-2 ${borderColor} pt-6`}>
                            <div className="w-1/3 bg-slate-900 text-white p-4 rounded-2xl shadow-xl">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{totalLabel}</p>
                                <p className="text-3xl font-black text-emerald-400">{formatMAD(data.total)}</p>
                                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-bold text-slate-400">
                                    Paiement: <span className="text-white uppercase">{data.paymentMethod}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 grid grid-cols-2 gap-10">
                            <div className="border border-slate-200 rounded-xl h-24 p-3 relative bg-slate-50/50">
                                <span className="absolute top-2 left-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Visa Responsable</span>
                            </div>
                            <div className="border border-slate-200 rounded-xl h-24 p-3 relative bg-slate-50/50">
                                <span className="absolute top-2 left-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cachet & Signature Client</span>
                            </div>
                        </div>

                        <div className="mt-12 text-center text-[8px] text-slate-400 border-t border-slate-100 pt-4">
                            ISSLI PECHE S.A.R.L - 19, Rue Bni Aamir, Bourgogne, Casablanca. <br/>
                            Ce document sert de preuve de livraison et de mouvement de stock interne.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};