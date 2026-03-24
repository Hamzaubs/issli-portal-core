import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, MapPin, Phone } from 'lucide-react';

interface Props {
    data: any;
    onClose: () => void;
}

export const InternalDeliveryNote: React.FC<Props> = ({ data, onClose }) => {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `BL_${data.id}`,
        onAfterPrint: onClose
    });

    const formatMAD = (amount: number) => 
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in">
            
            {/* ACTIONS */}
            <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                <button onClick={() => handlePrint && handlePrint()} className="bg-white text-slate-900 px-6 py-2 rounded-full font-bold shadow-lg hover:bg-slate-100 flex items-center gap-2">
                    <Printer size={18}/> Imprimer
                </button>
                <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700">
                    <X size={24}/>
                </button>
            </div>

            {/* RECEIPT PREVIEW (80mm Width Optimized) */}
            <div className="bg-slate-200 p-8 rounded-2xl shadow-2xl max-h-[90vh] overflow-auto">
                <div ref={componentRef} className="bg-white w-[80mm] min-h-[100mm] p-4 text-slate-900 mx-auto font-mono text-[10px] leading-tight shadow-sm">
                    
                    {/* HEADER */}
                    <div className="text-center mb-4 border-b border-dashed border-slate-300 pb-4">
                        <h1 className="text-xl font-black uppercase mb-1">BON DE LIVRAISON</h1>
                        <h2 className="font-bold uppercase">ISSLI PECHE</h2>
                        <div className="flex justify-center items-center gap-1 mt-1 text-[9px] text-slate-500">
                            <MapPin size={8}/> Casablanca
                        </div>
                        <div className="flex justify-center items-center gap-1 text-[9px] text-slate-500">
                            <Phone size={8}/> +212 5 22 00 00 00
                        </div>
                    </div>

                    {/* INFO */}
                    <div className="mb-4 space-y-1">
                        <div className="flex justify-between">
                            <span>Date:</span>
                            <span className="font-bold">{new Date(data.date).toLocaleDateString('fr-MA')} {new Date(data.date).toLocaleTimeString('fr-MA').slice(0,5)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Réf:</span>
                            <span className="font-bold">{data.id}</span>
                        </div>
                        {data.clientName && (
                            <div className="flex justify-between border-t border-dashed border-slate-200 pt-1 mt-1">
                                <span>Client:</span>
                                <span className="font-bold uppercase">{data.clientName}</span>
                            </div>
                        )}
                        {/* ✅ PAYMENT METHOD & REF */}
                        <div className="flex justify-between">
                            <span>Mode:</span>
                            <span className="font-bold uppercase">{data.paymentMethod || 'ESPÈCES'}</span>
                        </div>
                        {data.paymentRef && (
                            <div className="flex justify-between text-slate-500">
                                <span>N° Ref:</span>
                                <span className="font-bold">{data.paymentRef}</span>
                            </div>
                        )}
                    </div>

                    {/* ITEMS */}
                    <table className="w-full text-left mb-4 border-y border-dashed border-slate-300">
                        <thead className="font-bold">
                            <tr>
                                <th className="py-2">Art</th>
                                <th className="py-2 text-center">Qté</th>
                                <th className="py-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dashed divide-slate-100">
                            <tr>
                                <td className="py-2 pr-1">
                                    <div className="font-bold">{data.productName}</div>
                                    <div className="text-[9px] text-slate-400">{data.sku}</div>
                                </td>
                                <td className="py-2 text-center whitespace-nowrap">
                                    {data.quantity} <span className="text-[8px]">{data.measureUnit}</span>
                                </td>
                                <td className="py-2 text-right font-bold">
                                    {formatMAD(data.total)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* TOTALS */}
                    <div className="flex justify-between items-center text-sm font-black mb-6 border-b border-dashed border-slate-300 pb-4">
                        <span>NET À PAYER</span>
                        <span>{formatMAD(data.total)}</span>
                    </div>

                    {/* FOOTER */}
                    <div className="text-center text-[9px] text-slate-400">
                        <p className="mb-1">Marchandise livrée en bon état.</p>
                        <p>Merci de votre confiance !</p>
                        <p className="mt-2 font-mono text-[8px]">POS v3.9 • {new Date().getFullYear()}</p>
                    </div>

                </div>
            </div>
        </div>
    );
};