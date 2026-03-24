// web-ui/src/components/ClientStatement.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, FileText, MapPin, Phone, Loader2, Building2 } from 'lucide-react';
import client from '../api/client';

interface Props {
  clientId: string;
  onClose: () => void;
  silo: 'internal' | 'legal'; // ✅ The Chameleon Prop
}

export const ClientStatement: React.FC<Props> = ({ clientId, onClose, silo }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  
  // ✅ NEW: Expects the exact structure from our Backend Ledger Engine
  // { client, statement: [...], finalBalance }
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatement = async () => {
        try {
            // 🛡️ DYNAMIC ROUTING: Hits the dedicated Statement Endpoints we just audited
            const endpointUrl = silo === 'internal' 
                ? `/internal/clients/${clientId}/statement` 
                : `/legal/clients/${clientId}/statement`;

            const res = await client.get(endpointUrl);
            
            setData(res.data); // Set the perfect backend payload directly
        } catch (e) {
            console.error("Statement Load Error", e);
            alert("Erreur lors du chargement du relevé de compte.");
            onClose();
        } finally {
            setLoading(false);
        }
    };
    fetchStatement();
  }, [clientId, silo]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `RELEVE_${silo === 'internal' ? 'INTERNE' : 'OFFICIEL'}_${data?.client?.name || 'CLIENT'}`,
    bodyClass: "print-body"
  });

  const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

  if (loading) return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm text-white font-bold gap-3">
          <Loader2 className="animate-spin"/> Génération du relevé {silo === 'internal' ? 'interne' : 'officiel'}...
      </div>
  );

  if (!data || !data.client) return null;

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
         <button onClick={() => handlePrint && handlePrint()} className={`${silo === 'internal' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 transition-all`}>
            <Printer size={18}/> Imprimer ({silo === 'internal' ? 'Interne' : 'Officiel'})
         </button>
         <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
            <X size={24}/>
         </button>
      </div>

      {/* DOCUMENT PREVIEW */}
      <div className="my-8 print:my-0">
        <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] print-padding text-slate-900 mx-auto shadow-2xl print:shadow-none relative flex flex-col">
            
           {/* HEADER */}
           <div className={`flex justify-between items-start border-b-2 pb-6 mb-8 ${silo === 'internal' ? 'border-emerald-800' : 'border-blue-900'}`}>
               <div>
                   <h1 className={`text-2xl font-black uppercase tracking-tight leading-none mb-2 ${silo === 'internal' ? 'text-emerald-950' : 'text-blue-950'}`}>ISSLI PECHE</h1>
                   <div className="text-xs text-slate-500 space-y-1">
                       <p className="flex items-center gap-2"><MapPin size={12}/> 19, Rue Bni Aamir, Casablanca</p>
                       <p className="flex items-center gap-2"><Phone size={12}/> +212 5 22 00 00 00</p>
                   </div>
               </div>
               <div className="text-right">
                   <h2 className={`text-3xl font-black uppercase mb-1 tracking-tighter ${silo === 'internal' ? 'text-emerald-800' : 'text-blue-900'}`}>RELEVÉ DE COMPTE</h2>
                   <div className="flex items-center justify-end gap-2 text-sm font-bold text-slate-500 mb-3">
                       <Building2 size={14}/> <span>{silo === 'internal' ? 'Gestion Interne (Silo B)' : 'Version Officielle (Silo A)'}</span>
                   </div>
                   <div className={`${silo === 'internal' ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'} border rounded-lg p-2 px-4 inline-block text-right`}>
                       <p className={`text-[10px] uppercase font-bold ${silo === 'internal' ? 'text-emerald-600' : 'text-blue-400'}`}>Date d'édition</p>
                       <p className={`font-mono font-bold text-sm ${silo === 'internal' ? 'text-emerald-900' : 'text-blue-900'}`}>{new Date().toLocaleDateString('fr-MA')}</p>
                   </div>
               </div>
           </div>

           {/* CLIENT INFO */}
           <div className="flex justify-end mb-8">
                <div className="w-1/2 bg-white border-2 border-slate-100 rounded-xl p-5 print:border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                        <FileText size={12}/> Client
                    </p>
                    <h3 className="text-xl font-black text-slate-900 mb-1">{data.client.name}</h3>
                    {data.client.ice && <p className="text-xs font-mono text-slate-500">ICE: {data.client.ice}</p>}
                    
                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-100">
                        <span className="text-xs font-bold uppercase text-slate-500">Solde {silo === 'internal' ? 'Interne' : 'Légal'} à ce jour</span>
                        {/* ✅ Uses the mathematically safe finalBalance from the backend */}
                        <span className={`text-2xl font-black ${data.finalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatMAD(data.finalBalance)}
                        </span>
                    </div>
                </div>
           </div>

           {/* STATEMENT TABLE */}
           <div className="flex-1">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className={`${silo === 'internal' ? 'bg-emerald-800 print:bg-emerald-800' : 'bg-blue-900 print:bg-blue-900'} text-white uppercase text-[10px] tracking-wider print:text-white`}>
                            <th className="p-3 text-left rounded-tl-lg">Date</th>
                            <th className="p-3 text-left">Document / Réf</th>
                            <th className="p-3 text-right text-emerald-200">Crédit (Règlement)</th>
                            <th className="p-3 text-right text-amber-200">Débit (Facture/Vente)</th>
                            <th className="p-3 text-right rounded-tr-lg">Solde</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {/* Initial Balance */}
                        <tr className="bg-slate-50 italic text-slate-500 text-xs print:bg-slate-50">
                            <td className="p-3" colSpan={4}>Solde Initial</td>
                            <td className="p-3 text-right font-mono">0.00 MAD</td>
                        </tr>

                        {data.statement.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">Aucune opération trouvée.</td></tr>
                        ) : data.statement.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-slate-100">
                                <td className="p-3 text-xs font-mono text-slate-500">
                                    {new Date(row.date).toLocaleDateString('fr-MA')}
                                </td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-800 text-xs uppercase">
                                        {row.type} {row.ref && `- ${row.ref}`}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        {row.note || ''}
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
                    <p>ISSLI PECHE - Relevé {silo === 'internal' ? 'Interne' : 'Officiel'}. Ce document vaut justification de créance.</p>
                    <p>Page 1/1</p>
                </div>
           </div>

        </div>
      </div>
    </div>
  );
};