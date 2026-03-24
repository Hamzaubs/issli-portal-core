import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, FileText, X } from 'lucide-react';

interface QuoteItem {
  product: { name: string; internalSku: string; measureUnit: string };
  qty: number;
  unitPrice: number;
}

interface QuoteProps {
  items: QuoteItem[];
  clientName?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export const QuotePrinter = ({ items, clientName, onClose, onConfirm }: QuoteProps) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: componentRef });

  const total = items.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);
  const date = new Date().toLocaleDateString('fr-MA');

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95">
      <div className="bg-slate-200 rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        
        {/* HEADER */}
        <div className="p-4 bg-white border-b border-slate-300 flex justify-between items-center rounded-t-xl shrink-0">
           <h2 className="text-xl font-bold flex items-center gap-2 text-slate-700">
             <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><FileText size={20}/></div>
             Aperçu Devis
           </h2>
           <div className="flex gap-3">
             <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg flex items-center gap-2"><X size={18}/> Fermer</button>
             {onConfirm && (
                <button onClick={onConfirm} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-lg hover:bg-emerald-500 flex items-center gap-2">
                  💾 Enregistrer
                </button>
             )}
             <button onClick={() => handlePrint && handlePrint()} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800 flex items-center gap-2">
               <Printer size={18}/> Imprimer
             </button>
           </div>
        </div>

        {/* PREVIEW */}
        <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-500/10">
           <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] shadow-xl text-slate-900 relative">
              <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                  <div>
                     <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">ISSLI PECHE</h1>
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Équipements Marins & Industriels</p>
                     <p className="text-xs text-slate-400 mt-1">19 Rue Bni Aamir, Bourgogne, Casablanca</p>
                  </div>
                  <div className="text-right">
                     <div className="bg-amber-100 text-amber-700 px-4 py-2 font-black text-xl uppercase tracking-widest inline-block rounded">DEVIS ESTIMATIF</div>
                     <p className="mt-2 font-bold text-slate-600">Date: {date}</p>
                     <p className="text-sm text-slate-400">Validité: 15 Jours</p>
                  </div>
              </div>

              <div className="mb-12 bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Client</p>
                  <h2 className="text-2xl font-black text-slate-800">{clientName || "CLIENT COMPTOIR / PASSAGER"}</h2>
              </div>

              <table className="w-full mb-12">
                  <thead className="border-b-2 border-slate-900">
                      <tr>
                          <th className="py-3 text-left font-black uppercase text-xs">Désignation</th>
                          <th className="py-3 text-center font-black uppercase text-xs">Qté</th>
                          <th className="py-3 text-right font-black uppercase text-xs">P.U (DH)</th>
                          <th className="py-3 text-right font-black uppercase text-xs">Total (DH)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {items.map((item, i) => (
                          <tr key={i}>
                              <td className="py-4 font-bold text-slate-700">{item.product.name}<div className="text-[10px] text-slate-400 font-mono">{item.product.internalSku}</div></td>
                              <td className="py-4 text-center font-bold">{item.qty} {item.product.measureUnit}</td>
                              <td className="py-4 text-right font-mono text-slate-500">{item.unitPrice.toFixed(2)}</td>
                              <td className="py-4 text-right font-bold text-slate-900">{(item.unitPrice * item.qty).toFixed(2)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>

              <div className="flex justify-end">
                  <div className="w-1/2">
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                          <span className="font-bold text-slate-500">Total HT</span>
                          <span className="font-mono font-bold">{(total).toFixed(2)} DH</span>
                      </div>
                      <div className="flex justify-between items-center py-4 text-2xl font-black text-amber-600">
                          <span>NET À PAYER</span>
                          <span>{total.toLocaleString('fr-MA', {style:'currency', currency: 'MAD'})}</span>
                      </div>
                  </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};