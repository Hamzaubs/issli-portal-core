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
        onAfterPrint: onClose
    });

    const formatMAD = (amount: number) => 
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in overflow-y-auto">
            
            {/* ACTIONS */}
            <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
                <button onClick={() => handlePrint && handlePrint()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2 transition-all">
                    <Printer size={18}/> Imprimer A4
                </button>
                <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
                    <X size={24}/>
                </button>
            </div>

            {/* A4 DOCUMENT PREVIEW */}
            <div className="my-8">
                <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] text-slate-900 mx-auto shadow-2xl relative flex flex-col">
                    
                    {/* 1. HEADER */}
                    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center rounded-lg font-black text-xl">I</div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">ISSLI PECHE</h1>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Équipements Marins</p>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 space-y-1 mt-3">
                                <p className="flex items-center gap-2"><MapPin size={12}/> 19, Rue Bni Aamir, Casablanca</p>
                                <p className="flex items-center gap-2"><Phone size={12}/> +212 5 22 00 00 00</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-3xl font-black uppercase text-slate-800 mb-1">Bon de Livraison</h2>
                            <p className="text-sm font-bold text-slate-500 mb-4">Réf: {data.id}</p>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 inline-block text-right">
                                <p className="text-xs text-slate-400 uppercase font-bold">Date d'émission</p>
                                <p className="font-mono font-bold text-slate-800">{new Date(data.date).toLocaleDateString('fr-MA')}</p>
                                <p className="text-xs text-slate-400">{new Date(data.date).toLocaleTimeString('fr-MA')}</p>
                            </div>
                        </div>
                    </div>

                    {/* 2. CLIENT BOX */}
                    <div className="flex justify-end mb-12">
                        <div className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-6">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                                <FileText size={12}/> Client Destinataire
                            </p>
                            <h3 className="text-xl font-black text-slate-800 mb-1">{data.clientName || 'CLIENT COMPTOIR'}</h3>
                            <p className="text-sm text-slate-500">
                                {data.clientName === '-' || !data.clientName ? 'Client de passage' : 'Partenaire enregistré'}
                            </p>
                        </div>
                    </div>

                    {/* 3. ITEMS TABLE */}
                    <div className="flex-1">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white uppercase text-xs tracking-wider">
                                    <th className="p-4 text-left rounded-tl-lg">Description / Article</th>
                                    <th className="p-4 text-center">Quantité</th>
                                    <th className="p-4 text-center">Unité</th>
                                    <th className="p-4 text-right rounded-tr-lg">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                <tr className="border-b border-slate-100">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800 text-base">{data.productName}</div>
                                        <div className="text-xs text-slate-400 font-mono mt-1">Réf: {data.sku}</div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-lg">{data.quantity}</td>
                                    <td className="p-4 text-center text-slate-500 text-xs font-bold uppercase bg-slate-50">{data.measureUnit}</td>
                                    <td className="p-4 text-right font-bold text-slate-800">{formatMAD(data.total)}</td>
                                </tr>
                                {/* Empty rows for layout stability on paper */}
                                {[1, 2, 3].map(i => (
                                    <tr key={i}>
                                        <td className="p-4 text-slate-300 italic text-xs">-</td>
                                        <td className="p-4 text-center text-slate-200">-</td>
                                        <td className="p-4 text-center text-slate-200">-</td>
                                        <td className="p-4 text-center text-slate-200">-</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 4. TOTALS & PAYMENT */}
                    <div className="flex justify-between items-end border-t-2 border-slate-800 pt-6 mt-8">
                        
                        {/* Payment Info */}
                        <div className="w-1/2">
                            <h4 className="font-bold text-slate-800 uppercase text-xs mb-3">Informations de Règlement</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 w-24">Mode:</span>
                                    <span className="font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800 uppercase text-xs">
                                        {data.paymentMethod === 'CHECK' ? 'CHÈQUE' : 
                                         data.paymentMethod === 'TRANSFER' ? 'VIREMENT' : 
                                         data.paymentMethod === 'DELIVERY' ? 'À LA LIVRAISON' : 
                                         data.paymentMethod === 'CREDIT' ? 'CRÉDIT (À Terme)' : 'ESPÈCES'}
                                    </span>
                                </div>
                                {data.paymentRef && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 w-24">Référence:</span>
                                        <span className="font-mono font-bold text-slate-900">{data.paymentRef}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Total Box */}
                        <div className="w-1/3">
                            <div className="flex justify-between items-center py-2 border-b border-slate-200">
                                <span className="text-slate-500 font-bold text-xs uppercase">Total Net</span>
                                <span className="font-black text-2xl text-slate-900">{formatMAD(data.total)}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 text-right">
                                Arrêté le présent bon à la somme indiquée ci-dessus.
                            </p>
                        </div>
                    </div>

                    {/* 5. FOOTER / SIGNATURES */}
                    <div className="mt-16 grid grid-cols-2 gap-8">
                        <div className="border border-slate-200 rounded-xl h-32 p-4 relative">
                            <span className="absolute top-3 left-4 text-[10px] font-bold text-slate-400 uppercase">Visa Magasinier</span>
                        </div>
                        <div className="border border-slate-200 rounded-xl h-32 p-4 relative bg-slate-50/50">
                            <span className="absolute top-3 left-4 text-[10px] font-bold text-slate-400 uppercase">Cachet & Signature Client</span>
                            <p className="absolute bottom-3 right-4 text-[9px] text-slate-400">Lu et approuvé</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-8 text-center">
                        <p className="text-[10px] text-slate-400 font-medium">ISSLI PECHE - Gestion de Stock Interne (Silo B)</p>
                        <p className="text-[9px] text-slate-300 mt-1">Ce document est un bon de livraison interne et ne remplace pas une facture fiscale.</p>
                    </div>

                </div>
            </div>
        </div>
    );
};