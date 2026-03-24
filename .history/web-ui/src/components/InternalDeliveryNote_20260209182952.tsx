import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, MapPin, Phone, FileText, Box } from 'lucide-react';

interface Props {
    data: any;
    onClose: () => void;
}

export const InternalDeliveryNote: React.FC<Props> = ({ data, onClose }) => {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `BL_${data.id}`,
        onAfterPrint: onClose,
        // Ensure background graphics (colors) are printed
        bodyClass: "print-body" 
    });

    const formatMAD = (amount: number) => 
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in overflow-y-auto">
            
            {/* INJECT PRINT STYLES */}
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print-hidden { display: none !important; }
                    .print-padding { padding: 15mm !important; }
                }
            `}</style>

            {/* ACTIONS (Hidden on Print) */}
            <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
                <button onClick={() => handlePrint && handlePrint()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2 transition-all">
                    <Printer size={18}/> Imprimer A4
                </button>
                <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
                    <X size={24}/>
                </button>
            </div>

            {/* A4 DOCUMENT PREVIEW */}
            <div className="my-4 print:my-0">
                <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] print-padding text-slate-900 mx-auto shadow-2xl print:shadow-none relative flex flex-col">
                    
                    {/* 1. HEADER */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center rounded-lg font-black text-xl print:bg-slate-900 print:text-white">I</div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">ISSLI PECHE</h1>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Équipements Marins (Stock B)</p>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 space-y-1 mt-2">
                                <p className="flex items-center gap-2"><MapPin size={12}/> 19, Rue Bni Aamir, Casablanca</p>
                                <p className="flex items-center gap-2"><Phone size={12}/> +212 5 22 00 00 00</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-3xl font-black uppercase text-slate-800 mb-1 tracking-tighter">Bon de Livraison</h2>
                            <p className="text-sm font-bold text-slate-500 mb-3">Réf: {data.id}</p>
                            <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 px-4 inline-block text-right print:bg-slate-100">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Date d'émission</p>
                                <p className="font-mono font-bold text-slate-900 text-sm">{new Date(data.date).toLocaleDateString('fr-MA')}</p>
                                <p className="text-[10px] text-slate-400">{new Date(data.date).toLocaleTimeString('fr-MA')}</p>
                            </div>
                        </div>
                    </div>

                    {/* 2. CLIENT BOX */}
                    <div className="flex justify-end mb-8">
                        <div className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-5 print:bg-slate-50 print:border-slate-300">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                                <FileText size={12}/> Client Destinataire
                            </p>
                            <h3 className="text-lg font-black text-slate-900 mb-1">{data.clientName && data.clientName !== '-' ? data.clientName : 'CLIENT COMPTOIR'}</h3>
                            <p className="text-xs text-slate-500 italic">
                                {data.clientName && data.clientName !== '-' ? 'Client enregistré' : 'Client de passage'}
                            </p>
                        </div>
                    </div>

                    {/* 3. ITEMS TABLE */}
                    <div className="flex-1">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider print:bg-slate-900 print:text-white">
                                    <th className="p-3 text-left rounded-tl-lg">Description / Article</th>
                                    <th className="p-3 text-center">Quantité</th>
                                    <th className="p-3 text-center">Unité</th>
                                    <th className="p-3 text-right rounded-tr-lg">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                <tr className="border-b border-slate-100">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-900 text-sm">{data.productName}</div>
                                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Réf: {data.sku}</div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-lg">{data.quantity}</td>
                                    <td className="p-4 text-center text-slate-500 text-[10px] font-bold uppercase">{data.measureUnit}</td>
                                    <td className="p-4 text-right font-bold text-slate-900">{formatMAD(data.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 4. TOTALS & PAYMENT SECTION */}
                    <div className="break-inside-avoid">
                        <div className="flex justify-between items-end border-t-2 border-slate-900 pt-4 mt-6">
                            
                            {/* Payment Info */}
                            <div className="w-1/2 pr-8">
                                <h4 className="font-bold text-slate-900 uppercase text-[10px] mb-2">Informations de Règlement</h4>
                                <div className="space-y-1 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50 print:bg-slate-50">
                                    <div className="flex justify-between items-center border-b border-slate-200 pb-1 mb-1">
                                        <span className="text-slate-500">Mode de Paiement:</span>
                                        <span className="font-black text-slate-800 uppercase">
                                            {data.paymentMethod === 'CHECK' ? 'CHÈQUE' : 
                                            data.paymentMethod === 'TRANSFER' ? 'VIREMENT' : 
                                            data.paymentMethod === 'DELIVERY' ? 'À LA LIVRAISON' : 
                                            data.paymentMethod === 'CREDIT' ? 'CRÉDIT (À Terme)' : 'ESPÈCES'}
                                        </span>
                                    </div>
                                    {data.paymentRef && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Référence N°:</span>
                                            <span className="font-mono font-bold text-slate-900">{data.paymentRef}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Total Box */}
                            <div className="w-5/12">
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-slate-500 font-bold text-xs uppercase">Total Net TTC</span>
                                    <span className="font-black text-3xl text-slate-900">{formatMAD(data.total)}</span>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-1 text-right">
                                    Arrêté le présent bon à la somme indiquée ci-dessus.
                                </p>
                            </div>
                        </div>

                        {/* 5. FOOTER / SIGNATURES */}
                        <div className="mt-8 grid grid-cols-2 gap-8">
                            <div className="border border-slate-300 rounded-lg h-24 p-3 relative">
                                <span className="absolute top-2 left-3 text-[9px] font-bold text-slate-500 uppercase">Visa Magasinier</span>
                            </div>
                            <div className="border border-slate-300 rounded-lg h-24 p-3 relative bg-slate-50/50 print:bg-slate-50">
                                <span className="absolute top-2 left-3 text-[9px] font-bold text-slate-500 uppercase">Cachet & Signature Client</span>
                                <p className="absolute bottom-2 right-3 text-[8px] text-slate-400 italic">"Lu et approuvé"</p>
                            </div>
                        </div>

                        <div className="mt-6 text-center border-t border-slate-100 pt-4">
                            <p className="text-[10px] text-slate-500 font-bold">ISSLI PECHE S.A.R.L - Gestion de Stock Interne</p>
                            <p className="text-[8px] text-slate-400">Ce document est un bon de livraison généré électroniquement.</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};