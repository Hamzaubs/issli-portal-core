import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, FileText, X, MapPin, Phone } from 'lucide-react';

interface QuoteItem {
  product: { name: string; internalSku: string; measureUnit: string };
  qty: number;
  unitPrice: number;
}

interface QuoteProps {
  items: QuoteItem[];
  clientName?: string;
  onClose: () => void;
  onConfirm?: () => void; // Optional: If used in a flow where confirm is needed
}

export const QuotePrinter = ({ items, clientName, onClose, onConfirm }: QuoteProps) => {
  const componentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `DEVIS_${new Date().toISOString().slice(0,10)}`,
    bodyClass: "print-body"
  });

  const total = items.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);
  const date = new Date().toLocaleDateString('fr-MA');

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 overflow-y-auto">
      
      {/* INJECT PRINT STYLES */}
      <style>{`
        @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-hidden { display: none !important; }
            .print-padding { padding: 15mm !important; }
        }
      `}</style>

      {/* HEADER / CONTROLS */}
      <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
         {onConfirm && (
            <button onClick={onConfirm} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-emerald-500 flex items-center gap-2 transition-all">
                💾 Enregistrer
            </button>
         )}
         <button onClick={() => handlePrint && handlePrint()} className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2 transition-all">
            <Printer size={18}/> Imprimer A4
         </button>
         <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
            <X size={24}/>
         </button>
      </div>

      {/* A4 PREVIEW */}
      <div className="my-8 print:my-0">
        <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] print-padding text-slate-900 mx-auto shadow-2xl print:shadow-none relative flex flex-col">
           
           {/* 1. HEADER */}
           <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
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
                    <h2 className="text-3xl font-black uppercase text-amber-600 mb-1 tracking-tighter">DEVIS ESTIMATIF</h2>
                    <p className="text-sm font-bold text-slate-500 mb-3">Réf: PROFORMA</p>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 px-4 inline-block text-right print:bg-amber-50">
                        <p className="text-[10px] text-amber-800 uppercase font-bold">Date d'émission</p>
                        <p className="font-mono font-bold text-slate-900 text-sm">{date}</p>
                        <p className="text-[10px] text-slate-400">Validité: 15 Jours</p>
                    </div>
                </div>
           </div>

           {/* 2. CLIENT BOX */}
           <div className="flex justify-end mb-12">
                <div className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-5 print:bg-slate-50 print:border-slate-300">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                        <FileText size={12}/> Client
                    </p>
                    <h3 className="text-xl font-black text-slate-900 mb-1">{clientName || 'CLIENT COMPTOIR'}</h3>
                    <p className="text-xs text-slate-500 italic">
                        {clientName ? 'Compte Client' : 'Client de passage'}
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
                            <th className="p-3 text-right">P.U (DH)</th>
                            <th className="p-3 text-right rounded-tr-lg">Total HT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {items.map((item, i) => (
                            <tr key={i} className="border-b border-slate-100">
                                <td className="p-4">
                                    <div className="font-bold text-slate-900 text-sm">{item.product.name}</div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">Réf: {item.product.internalSku}</div>
                                </td>
                                <td className="p-4 text-center font-bold text-lg">
                                    {item.qty} <span className="text-[10px] text-slate-400 font-normal uppercase">{item.product.measureUnit}</span>
                                </td>
                                <td className="p-4 text-right font-mono text-slate-500">
                                    {item.unitPrice.toFixed(2)}
                                </td>
                                <td className="p-4 text-right font-bold text-slate-900">
                                    {(item.qty * item.unitPrice).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>

           {/* 4. TOTALS */}
           <div className="break-inside-avoid">
                <div className="flex justify-end border-t-2 border-amber-500 pt-4 mt-6">
                    <div className="w-5/12">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500 font-bold text-xs uppercase">Total HT</span>
                            <span className="font-mono font-bold text-slate-700">{total.toFixed(2)} DH</span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                            <span className="text-amber-600 font-bold text-sm uppercase">Total Estimé TTC</span>
                            <span className="font-black text-3xl text-slate-900">{total.toLocaleString('fr-MA', {style:'currency', currency: 'MAD'})}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 text-right italic">
                            Ce devis est donné à titre indicatif et ne constitue pas une facture.
                        </p>
                    </div>
                </div>

                <div className="mt-16 text-center border-t border-slate-100 pt-4">
                    <p className="text-[10px] text-slate-500 font-bold">ISSLI PECHE S.A.R.L - Stock Interne</p>
                    <p className="text-[8px] text-slate-400">Merci de votre confiance.</p>
                </div>
           </div>

        </div>
      </div>
    </div>
  );
};