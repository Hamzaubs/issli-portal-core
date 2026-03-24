// web-ui/src/components/PaymentReceipt.tsx
import React, { useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, CheckCircle, User } from 'lucide-react';

interface PaymentData {
  id: string;
  date: Date;
  clientName: string;
  amount: number;
  method: string;     // CASH, CHECK, TRANSFER
  reference?: string; // Check number etc.
  note?: string;
  context?: string;   // ✅ Added to support STOCK A / STOCK B context
}

export const PaymentReceipt = ({ data, onClose }: { data: PaymentData, onClose: () => void }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    onAfterPrint: onClose
  });

  // Auto-print on mount
  useEffect(() => {
    if (handlePrint) {
      handlePrint();
    }
  }, [handlePrint]);

  const formatMAD = (amount: number) => 
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

  const getMethodLabel = (m: string) => {
      switch(m) {
          case 'CASH': return 'ESPÈCES';
          case 'CHECK': return 'CHÈQUE';
          case 'TRANSFER': return 'VIREMENT';
          default: return m;
      }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl overflow-hidden max-w-sm w-full">
        
        {/* PRINTABLE AREA (80mm) */}
        <div ref={componentRef} className="p-6 bg-white text-slate-900 font-mono text-sm leading-relaxed">
           <div className="text-center border-b-2 border-slate-900 pb-4 mb-4 border-dashed">
               <h1 className="text-xl font-black uppercase tracking-tighter">ISSLI PECHE</h1>
               {data.context && <p className="text-[10px] font-bold uppercase tracking-widest mb-1">{data.context}</p>}
               
               <div className="flex justify-center items-center gap-2 mt-2">
                   <CheckCircle size={16} className="text-black"/>
                   <span className="font-bold uppercase border-2 border-black px-2 py-0.5 text-xs">Bon de Versement</span>
               </div>
               <p className="text-[10px] mt-2 text-slate-500">{data.date.toLocaleString()}</p>
               <p className="text-[10px] text-slate-400">Ref: {data.id}</p>
           </div>

           {/* CLIENT INFO */}
           <div className="mb-4 bg-slate-50 p-2 border border-slate-200 rounded">
               <div className="flex items-center gap-2 mb-1">
                   <User size={12} />
                   <span className="text-[10px] font-bold uppercase text-slate-500">Client</span>
               </div>
               <div className="font-black text-sm uppercase">{data.clientName}</div>
           </div>

           {/* PAYMENT DETAILS */}
           <div className="mb-6">
              <div className="flex justify-between items-center mb-2 border-b border-slate-900 border-dashed pb-2">
                 <span className="font-bold">MONTANT VERSÉ</span>
                 <span className="font-black text-xl">{formatMAD(data.amount)}</span>
              </div>

              <div className="flex justify-between text-xs mb-1">
                 <span className="text-slate-500">Mode de paiement</span>
                 <span className="font-bold">{getMethodLabel(data.method)}</span>
              </div>

              {data.reference && (
                  <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Référence</span>
                      <span className="font-mono">{data.reference}</span>
                  </div>
              )}
           </div>

           {/* SIGNATURE AREA */}
           <div className="mt-8 pt-4 border-t border-slate-300">
               <div className="flex justify-between text-[10px] text-slate-400 mb-8">
                   <span>Signature Client</span>
                   <span>Signature Caissier</span>
               </div>
           </div>

           <div className="text-center text-[10px] font-bold text-slate-500 mt-4">
               POUR ACQUIT<br/>
               MERCI DE VOTRE CONFIANCE
           </div>
        </div>

        {/* ACTIONS */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                <X size={18} /> Fermer
            </button>
            <button onClick={() => handlePrint && handlePrint()} className="flex-1 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-lg">
                <Printer size={18} /> Imprimer
            </button>
        </div>
      </div>
    </div>
  );
};