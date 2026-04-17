// web-ui/src/components/InternalDeliveryNote.tsx
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, Package, ArrowLeftRight, FileText, AlertCircle } from 'lucide-react';

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
        bodyClass: "print-body" 
    });

    const formatMAD = (amount: number) => 
        new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount || 0);

    const getUnitLabel = (unit?: string) => { 
        switch(unit) { 
            case 'M': return 'm'; 
            case 'KG': return 'kg'; 
            case 'L': return 'L'; 
            case 'UNIT': default: return 'u'; 
        } 
    };

    const getPaymentMethodLabel = (m?: string) => {
        switch(m) {
            case 'CASH': case 'ESPECES': return 'ESPÈCES';
            case 'CHECK': case 'CHEQUE': return 'CHÈQUE';
            case 'TRANSFER': case 'VIREMENT': return 'VIREMENT';
            case 'CREDIT': return 'CRÉDIT (NON PAYÉ)';
            default: return m || '-';
        }
    };

    // 🛡️ STRICT SCHEMA ALIGNMENT: Prioritizes priceTTC
    const rawItemsList = data.items && data.items.length > 0 ? data.items : [{
        productName: data.productName || data.name || '-',
        sku: data.sku || data.productSku || data.internalSku || '-',
        quantity: data.quantity || 0,
        measureUnit: data.measureUnit || 'UNIT',
        unitPrice: data.unitPrice || data.priceTTC || data.sellingPrice || 0,
        total: data.total || data.amount || 0
    }];

    // 🧮 STRICT CENT-MATH: Eradicates floating point drift on printed documents
    const consolidatedItems = rawItemsList.reduce((acc: any[], item: any) => {
        const matchingKey = item.sku !== '-' ? item.sku : item.productName;
        const existingItem = acc.find(i => (i.sku !== '-' && i.sku === matchingKey) || i.productName === matchingKey);
        
        if (existingItem) {
            existingItem.quantity = Number(existingItem.quantity) + Number(item.quantity);
            existingItem.total = (Math.round(existingItem.total * 100) + Math.round(item.total * 100)) / 100;
        } else {
            acc.push({ ...item, quantity: Number(item.quantity), total: Number(item.total) });
        }
        return acc;
    }, []);

    // 🧮 STRICT CENT-MATH for Global Total
    const computedTotal = data.total !== undefined 
        ? data.total 
        : consolidatedItems.reduce((sum: number, item: any) => sum + Math.round(item.total * 100), 0) / 100;

    const docType = data.isQuote ? 'DEVIS' : data.isReturn ? "BON D'AVOIR" : 'BON DE LIVRAISON';
    const totalLabel = data.isQuote ? 'Total Estimé' : data.isReturn ? 'Total Avoir (Crédit)' : 'Total Net à Payer';
    const subLabel = data.isQuote ? 'Proposition commerciale' : data.isReturn ? 'Montant à déduire ou rembourser' : 'Valeur de la marchandise livrée';
    const themeColor = data.isReturn ? 'text-red-600' : data.isQuote ? 'text-amber-600' : 'text-slate-800';

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in overflow-y-auto">
            
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print-hidden { display: none !important; }
                }
            `}</style>

            <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
                <button onClick={() => handlePrint && handlePrint()} className="bg-emerald-700 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-emerald-800 flex items-center gap-2 transition-all">
                    <Printer size={18}/> Imprimer
                </button>
                <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
                    <X size={24}/>
                </button>
            </div>

            <div className="my-4 print:my-0 w-full flex justify-center">
                {/* pt-[45mm] allows space for pre-printed paper header */}
                <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] px-[15mm] pt-[45mm] pb-[15mm] text-slate-900 shadow-2xl print:shadow-none relative flex flex-col">
                    
                    {/* LETTERHEAD READY HEADER */}
                    <div className="flex justify-end items-start mb-8 relative z-10">
                        <div className="text-right">
                          <h2 className={`text-4xl font-light uppercase tracking-wide mb-1 print:${themeColor} ${themeColor}`}>{docType}</h2>
                          <p className="text-slate-900 font-bold text-lg">Réf: {data.id || '-'}</p>
                          <p className="text-slate-500 text-xs mt-1">Date : {(data.date || data.createdAt) ? new Date(data.date || data.createdAt).toLocaleDateString('fr-MA') : '-'}</p>
                        </div>
                    </div>

                    {/* ALERTS */}
                    {data.isReturn && (
                        <div className="flex items-center gap-3 mb-6 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-xs font-bold print:bg-red-50 print:border-red-100">
                            <AlertCircle size={16}/> DOCUMENT D'AVOIR : Ce bon justifie l'annulation ou le retour de marchandises.
                        </div>
                    )}

                    {/* CLIENT INFO */}
                    <div className="flex justify-start mb-10 relative z-10">
                        <div className="w-[55%] bg-slate-50 border border-slate-200 rounded-xl p-5 print:bg-slate-50 print:border-slate-300 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                                {data.isReturn ? <ArrowLeftRight size={12}/> : <FileText size={12}/>} 
                                {data.isReturn ? 'Client (Expéditeur)' : 'Client / Destinataire'}
                            </p>
                            <h3 className="text-lg font-black text-slate-900 mb-1">{data.clientName && data.clientName !== '-' ? data.clientName : 'CLIENT COMPTOIR'}</h3>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div className="flex-1">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold tracking-wider print:bg-slate-50 border-y border-slate-200">
                                    <th className="p-3 text-left w-1/2">Description / Article</th>
                                    <th className="p-3 text-center">Quantité</th>
                                    <th className="p-3 text-right">P.U / Info</th>
                                    <th className="p-3 text-right">Montant Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-xs">
                                {consolidatedItems.map((item: any, idx: number) => {
                                    const isDeduction = item.total < 0;
                                    return (
                                        <tr key={idx} className={`border-b border-slate-50 ${isDeduction ? 'bg-red-50/30 print:bg-transparent' : ''}`}>
                                            <td className="p-4">
                                                <div className={`font-bold text-sm ${isDeduction ? 'text-red-800' : 'text-slate-900'}`}>{item.productName}</div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                                                    <Package size={10}/> Réf: {item.sku}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-bold text-lg">
                                                {item.quantity !== 0 ? Math.abs(item.quantity) : '-'} 
                                                <span className="text-[10px] text-slate-400 font-normal uppercase ml-1">{item.quantity !== 0 ? getUnitLabel(item.measureUnit) : ''}</span>
                                            </td>
                                            <td className="p-4 text-right text-slate-500 font-mono text-[10px]">
                                                {item.quantity !== 0 ? formatMAD(item.unitPrice) : '-'}
                                            </td>
                                            <td className={`p-4 text-right font-black ${isDeduction ? 'text-red-600' : 'text-slate-900'}`}>
                                                {formatMAD(item.total)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* FOOTER & TOTALS */}
                    <div className="break-inside-avoid mt-8">
                        <div className={`flex justify-between items-end border-t border-slate-200 pt-4 mt-6`}>
                            <div className="w-1/2 pr-8">
                                <h4 className="font-bold text-slate-900 uppercase text-[10px] mb-2">Modalité de la transaction</h4>
                                <div className="space-y-1 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50 print:bg-slate-50">
                                    <div className="flex flex-col">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Règlement:</span>
                                            <span className={`font-black uppercase tracking-wide ${data.isQuote ? 'text-amber-600' : 'text-slate-800'}`}>
                                                {data.isQuote ? 'À DÉTERMINER' : getPaymentMethodLabel(data.paymentMethod)}
                                            </span>
                                        </div>
                                        {/* ✅ INJECT REFERENCE FOR CHECKS / VIREMENTS */}
                                        {data.paymentRef && data.paymentRef !== data.id && !data.isQuote && (
                                            <div className="flex justify-between items-center mt-1 border-t border-slate-200 pt-1">
                                                <span className="text-slate-500">Référence:</span>
                                                <span className="font-mono text-[10px] font-bold text-slate-600">{data.paymentRef}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="w-5/12">
                                <div className={`flex justify-between items-center py-2 px-3 rounded-lg print:bg-slate-50 ${computedTotal < 0 ? 'bg-red-50' : 'bg-slate-50 border border-slate-200'}`}>
                                    <span className={`font-bold text-xs uppercase print:${themeColor} ${themeColor}`}>{totalLabel}</span>
                                    <span className={`font-black text-2xl print:${themeColor} ${themeColor}`}>{formatMAD(computedTotal)}</span>
                                </div>
                                <p className="text-[9px] text-slate-400 mt-1 text-right px-1">
                                    {subLabel}
                                </p>
                            </div>
                        </div>

                        {/* SIGNATURES */}
                        <div className="mt-8 grid grid-cols-2 gap-8">
                            <div className="border border-slate-300 rounded-lg h-24 p-3 relative">
                                <span className="absolute top-2 left-3 text-[9px] font-bold text-slate-500 uppercase">Visa Responsable</span>
                            </div>
                            <div className="border border-slate-300 rounded-lg h-24 p-3 relative bg-slate-50/50 print:bg-slate-50">
                                <span className="absolute top-2 left-3 text-[9px] font-bold text-slate-500 uppercase">Cachet & Signature Client</span>
                                <p className="absolute bottom-2 right-3 text-[8px] text-slate-400 italic">"Lu et approuvé"</p>
                            </div>
                        </div>

                        {/* INTENTIONALLY BLANK FOOTER SPACE FOR PRE-PRINTED PAPER */}
                    </div>

                </div>
            </div>
        </div>
    );
};