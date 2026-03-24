import React, { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, FileText, MapPin, Phone, Loader2 } from 'lucide-react';
import client from '../api/client';

interface Props {
  clientId: string;
  onClose: () => void;
}

export const ClientStatement: React.FC<Props> = ({ clientId, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        try {
            // 1. Get Profile Details (Name, Balance, etc.)
            const profileRes = await client.get(`/internal/clients/${clientId}/details`);
            
            // 2. Get Full History (High limit to get all transactions for the statement)
            const historyRes = await client.get(`/internal/clients/${clientId}/history?limit=2000`);
            
            // 3. Process Data
            // The history comes sorted DESC (newest first). 
            // For a statement, we often want Oldest -> Newest to show calculation.
            const rawHistory = historyRes.data.data.reverse();

            setData({
                profile: profileRes.data.profile,
                history: rawHistory
            });
        } catch (e) {
            console.error("Statement Load Error", e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [clientId]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `RELEVE_${data?.profile?.name || 'CLIENT'}`,
    bodyClass: "print-body"
  });

  const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

  if (loading) return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm text-white font-bold gap-3">
          <Loader2 className="animate-spin"/> Génération du relevé...
      </div>
  );

  if (!data) return null;

  // 🧮 CALCULATE RUNNING BALANCE
  let runningBalance = 0;
  
  const statementRows = data.history.map((row: any) => {
      // Logic: 
      // Sale/Return (Debit) increases debt (+). 
      // Payment (Credit) decreases debt (-).
      // Note: In your DB, 'amount' might already be signed. 
      // We assume: SALES are positive (Debit), RETURNS/PAYMENTS are negative (Credit) in the calculation logic, 
      // but for the statement we split them into columns.
      
      let debit = 0;
      let credit = 0;

      // Classify based on Type
      if (row.type === 'SALE_CASH' || row.type === 'SALE_CREDIT' || row.type === 'QUOTE') {
          debit = Math.abs(row.amount);
          runningBalance += debit;
      } else {
          // Payments, Returns, etc.
          credit = Math.abs(row.amount);
          runningBalance -= credit;
      }

      return { ...row, debit, credit, balance: runningBalance };
  });

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 overflow-y-auto">
      
      {/* PRINT CSS */}
      <style>{`
        @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-hidden { display: none !important; }
            .print-padding { padding: 15mm !important; }
        }
      `}</style>

      {/* CONTROLS */}
      <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
         <button onClick={() => handlePrint && handlePrint()} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-emerald-700 flex items-center gap-2 transition-all">
            <Printer size={18}/> Imprimer
         </button>
         <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
            <X size={24}/>
         </button>
      </div>

      {/* DOCUMENT PREVIEW */}
      <div className="my-8 print:my-0">
        <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] print-padding text-slate-900 mx-auto shadow-2xl print:shadow-none relative flex flex-col">
           
           {/* HEADER */}
           <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none mb-2">ISSLI PECHE</h1>
                    <div className="text-xs text-slate-500 space-y-1">
                        <p className="flex items-center gap-2"><MapPin size={12}/> 19, Rue Bni Aamir, Casablanca</p>
                        <p className="flex items-center gap-2"><Phone size={12}/> +212 5 22 00 00 00</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-3xl font-black uppercase text-slate-800 mb-1 tracking-tighter">RELEVÉ DE COMPTE</h2>
                    <p className="text-sm font-bold text-slate-500 mb-3">Interne (Silo B)</p>
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 px-4 inline-block text-right print:bg-slate-100">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Date d'édition</p>
                        <p className="font-mono font-bold text-slate-900 text-sm">{new Date().toLocaleDateString('fr-MA')}</p>
                    </div>
                </div>
           </div>

           {/* CLIENT INFO */}
           <div className="flex justify-end mb-8">
                <div className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl p-5 print:bg-slate-50 print:border-slate-300">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                        <FileText size={12}/> Client Partenaire
                    </p>
                    <h3 className="text-xl font-black text-slate-900 mb-1">{data.profile.name}</h3>
                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-200">
                        <span className="text-xs font-bold uppercase text-slate-500">Solde Actuel</span>
                        <span className={`text-2xl font-black ${data.profile.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatMAD(data.profile.balance)}
                        </span>
                    </div>
                </div>
           </div>

           {/* STATEMENT TABLE */}
           <div className="flex-1">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider print:bg-slate-900 print:text-white">
                            <th className="p-3 text-left rounded-tl-lg">Date</th>
                            <th className="p-3 text-left">Libellé / Réf</th>
                            <th className="p-3 text-right text-emerald-300">Crédit (Paiement)</th>
                            <th className="p-3 text-right text-amber-300">Débit (Achat)</th>
                            <th className="p-3 text-right rounded-tr-lg">Solde Progressif</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {/* Initial Balance Row (Assuming 0 for full history view) */}
                        <tr className="bg-slate-50 italic text-slate-500 text-xs print:bg-slate-50">
                            <td className="p-3" colSpan={4}>Solde Initial</td>
                            <td className="p-3 text-right font-mono">0.00 MAD</td>
                        </tr>

                        {statementRows.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100">
                                <td className="p-3 text-xs font-mono text-slate-500">
                                    {new Date(row.date).toLocaleDateString('fr-MA')}
                                </td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-800 text-xs uppercase">
                                        {row.type === 'SALE_CASH' || row.type === 'SALE_CREDIT' ? 'Vente Marchandise' : 
                                         row.type === 'RETURN' ? 'Retour Marchandise' : 
                                         row.type === 'QUOTE' ? 'Devis (Info)' : 'Règlement / Acompte'}
                                    </div>
                                    <div className="text-[9px] text-slate-400">
                                        {row.productName !== 'Article Supprimé' ? row.productName : ''} 
                                        {row.paymentRef ? ` (Réf: ${row.paymentRef})` : ''}
                                    </div>
                                </td>
                                <td className="p-3 text-right font-mono text-emerald-700 font-bold">
                                    {row.credit > 0 ? formatMAD(row.credit) : '-'}
                                </td>
                                <td className="p-3 text-right font-mono text-amber-700 font-bold">
                                    {row.debit > 0 ? formatMAD(row.debit) : '-'}
                                </td>
                                <td className={`p-3 text-right font-mono font-black ${row.balance > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                    {formatMAD(row.balance)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>

           {/* FOOTER */}
           <div className="break-inside-avoid mt-8 border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center text-[10px] text-slate-400 italic">
                    <p>ISSLI PECHE - Gestion Interne. Ce document vaut justification de solde.</p>
                    <p>Page 1/1</p>
                </div>
           </div>

        </div>
      </div>
    </div>
  );
};