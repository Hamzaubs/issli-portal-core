// web-ui/src/components/ClientStatement.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, FileText, Loader2, Building2 } from 'lucide-react';
import client from '../api/client';

interface Props {
  clientId: string;
  onClose: () => void;
  silo: 'internal' | 'legal'; 
}

export const ClientStatement: React.FC<Props> = ({ clientId, onClose, silo }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatement = async () => {
        try {
            const endpointUrl = silo === 'internal' 
                ? `/internal/clients/${clientId}/statement` 
                : `/legal/clients/${clientId}/statement`;

            const res = await client.get(endpointUrl);
            setData(res.data);
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
      
      <style>{`
        @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-hidden { display: none !important; }
        }
      `}</style>

      <div className="absolute top-4 right-4 flex gap-2 print:hidden z-50">
         <button onClick={() => handlePrint && handlePrint()} className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 transition-all">
            <Printer size={18}/> Imprimer ({silo === 'internal' ? 'Interne' : 'Officiel'})
         </button>
         <button onClick={onClose} className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-all">
            <X size={24}/>
         </button>
      </div>

      <div className="my-8 print:my-0 flex justify-center w-full">
        {/* pt-[45mm] allows space for pre-printed paper header */}
        <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] px-[15mm] pt-[45mm] pb-[15mm] text-slate-900 shadow-2xl print:shadow-none relative flex flex-col">
            
           {/* HEADER (Letterhead Ready) */}
           <div className="flex justify-end items-start pb-6 mb-8">
               <div className="text-right">
                   <h2 className="text-4xl font-light uppercase tracking-wide mb-1 text-slate-800">RELEVÉ DE COMPTE</h2>
                   <div className="flex items-center justify-end gap-2 text-sm font-bold text-slate-500 mb-3">
                       <Building2 size={14}/> <span>{silo === 'internal' ? 'Gestion Interne' : 'Version Officielle'}</span>
                   </div>
                   <p className="text-slate-500 text-xs mt-1">Date d'édition : {new Date().toLocaleDateString('fr-MA')}</p>
               </div>
           </div>

           {/* CLIENT INFO */}
           <div className="flex justify-start mb-8">
                <div className="w-[55%] bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                        <FileText size={12}/> Client
                    </p>
                    <h3 className="text-xl font-black text-slate-900 mb-1">{data.client.name}</h3>
                    {data.client.ice && <p className="text-xs font-mono text-slate-500">ICE: {data.client.ice}</p>}
                    
                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-200">
                        <span className="text-xs font-bold uppercase text-slate-500">Solde {silo === 'internal' ? 'Interne' : 'Légal'}</span>
                        <span className={`text-2xl font-black ${data.finalBalance > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            {formatMAD(data.finalBalance)}
                        </span>
                    </div>
                </div>
           </div>

           {/* STATEMENT TABLE */}
           <div className="flex-1">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold border-y border-slate-200">
                        <tr>
                            <th className="p-3 text-left">Date</th>
                            <th className="p-3 text-left">Document / Réf</th>
                            <th className="p-3 text-right">Crédit (Règlement)</th>
                            <th className="p-3 text-right">Débit (Facture)</th>
                            <th className="p-3 text-right">Solde</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                        <tr className="bg-white italic text-slate-500">
                            <td className="p-3" colSpan={4}>Solde Initial</td>
                            <td className="p-3 text-right font-mono">0.00 MAD</td>
                        </tr>

                        {data.statement.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">Aucune opération trouvée.</td></tr>
                        ) : data.statement.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-slate-50">
                                <td className="p-3 font-mono text-slate-500">
                                    {new Date(row.date).toLocaleDateString('fr-MA')}
                                </td>
                                <td className="p-3">
                                    <div className="font-bold text-slate-800 uppercase">
                                        {row.type} {row.ref && `- ${row.ref}`}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        {row.note || ''}
                                    </div>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-600 font-bold">
                                    {row.credit > 0 ? formatMAD(row.credit) : '-'}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-600 font-bold">
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

           {/* BLANK FOOTER AREA */}
        </div>
      </div>
    </div>
  );
};