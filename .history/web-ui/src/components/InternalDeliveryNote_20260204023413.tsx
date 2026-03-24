// web-ui/src/components/InternalDeliveryNote.tsx
import React, { useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Printer } from 'lucide-react';

interface ReceiptData {
  id: string;
  date: Date;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  measureUnit: string;
  technicalSpecs?: string;
  clientName?: string;
  paymentMethod?: string;
  isReturn?: boolean; 
}

export const InternalDeliveryNote = ({ data, onClose }: { data: ReceiptData, onClose: () => void }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    onAfterPrint: onClose
  });

  useEffect(() => {
    if (handlePrint) {
      handlePrint();
    }
  }, [handlePrint]);

  const formatMAD = (amount: number) => 
    new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Math.abs(amount));

  const isCredit = data.paymentMethod === 'CREDIT' || data.paymentMethod === 'DELIVERY';
  const isReturn = data.isReturn;
  
  let title = "TICKET DE CAISSE";
  if (isReturn) {
      title = isCredit ? "BON D'AVOIR" : "BON DE RETOUR"; 
  } else if (isCredit) {
      title = "BON DE LIVRAISON"; 
  }

  return (
    // ✅ FIX: Removed overflow-hidden from the outer container to allow scrolling if needed
    <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full flex flex-col my-auto">
        
        {/* PRINTABLE AREA */}
        <div ref={componentRef} className="p-6 bg-white text-slate-900 font-mono text-sm leading-relaxed">
           <div className="text-center border-b-2 border-slate-900 pb-4 mb-4 border-dashed">
               <h1 className="text-2xl font-black uppercase tracking-tighter">ISSLI PECHE</h1>
               {/* ✅ STOCK B DESIGNATION */}
               <p className="text-[10px] font-bold uppercase tracking-widest mb-2">Magasin Interne (STOCK B)</p>
               
               <p className="text-sm font-black border-2 border-slate-900 inline-block px-2 py-1 mt-1 rounded">{title}</p>
               <p className="text-[10px] mt-2 text-slate-500">{data.date.toLocaleString()}</p>
               <p className="text-[10px] text-slate-400">Ref: {data.id}</p>
           </div>

           <div className="mb-4 text-xs">
               <div className="flex justify-between font-bold">
                   <span>CLIENT:</span>
                   <span>{data.clientName || "Passager"}</span>
               </div>
               <div className="flex justify-between">
                   <span>MODE:</span>
                   <span className="font-bold uppercase">{data.paymentMethod || "CASH"}</span>
               </div>
           </div>

           <div className="mb-4">
              <div className="flex justify-between items-start mb-1 font-bold">
                 <span className="max-w-[70%]">{data.productName}</span>
                 <span>{formatMAD(data.total)}</span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                 <span>{data.quantity} {data.measureUnit} x {data.unitPrice} DH</span>
                 <span>{data.sku}</span>
              </div>
              {data.technicalSpecs && (
                  <div className="text-[10px] italic text-slate-400 mt-1">({data.technicalSpecs})</div>
              )}
           </div>

           <div className="border-t-2 border-slate-900 border-dashed pt-4 mb-4">
              <div className="flex justify-between items-center text-lg font-black">
                  <span>TOTAL {isReturn ? 'RENDU' : ''}</span>
                  <span>{formatMAD(data.total)}</span>
              </div>
              
              {isCredit && (
                  <div className={`mt-2 text-center text-[10px] font-bold border p-1 uppercase ${isReturn ? 'border-green-600 text-green-700 bg-green-50' : 'border-red-600 text-red-700 bg-red-50'}`}>
                      {isReturn 
                        ? "Montant DÉDUIT du solde (Avoir)" 
                        : "Montant AJOUTÉ au solde (Dette)"}
                  </div>
              )}
           </div>

           <div className="text-center text-[10px] font-bold text-slate-500">
               MERCI DE VOTRE VISITE<br/>
               ISSLI PECHE - STOCK B
           </div>
        </div>

        {/* ACTIONS (Always Visible) */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex gap-2 shrink-0">
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