// web-ui/src/components/SupplierStatementPrint.tsx
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X } from 'lucide-react';

interface SupplierStatementPrintProps {
    supplier: any;
    statement: any[];
    isLegal?: boolean; 
    onClose: () => void;
}

export const SupplierStatementPrint = ({ supplier, statement, isLegal = false, onClose }: SupplierStatementPrintProps) => {
  const componentRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: componentRef, documentTitle: `Relevé_${supplier?.name || 'Fournisseur'}` });
  
  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(amount) || 0);
  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  
  const finalBalance = statement && statement.length > 0 ? statement[statement.length - 1].balance : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-100 w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-700">
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-50">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Printer size={20} className="text-slate-600" /> 
              <span>APERÇU PAPIER EN-TÊTE</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-slate-800 text-white hover:bg-slate-900 px-6 py-2 rounded-lg font-bold transition-all shadow-lg"><Printer size={18} /> IMPRIMER</button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center">
          <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] px-[15mm] pt-[45mm] pb-[15mm] text-slate-900 relative text-sm shadow-xl flex flex-col">
            <style>{`@media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

            <div className="flex justify-end items-start mb-8 relative z-10">
                <div className="text-right">
                  <h2 className="text-4xl font-light uppercase tracking-wide mb-1 text-slate-800">Relevé de Compte</h2>
                  <p className="text-slate-900 font-bold text-lg">Fournisseur</p>
                  <p className="text-slate-500 text-xs mt-1">Édité le : {new Date().toLocaleDateString('fr-MA')}</p>
                </div>
            </div>

            <div className="flex justify-start mb-10 relative z-10">
                <div className="w-[55%] bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Fournisseur</p>
                    <h3 className="text-xl font-black text-slate-900 mb-1">{supplier?.name || '-'}</h3>
                    <div className="text-[11px] text-slate-600 space-y-1">
                        <p>ICE: <span className="font-mono font-bold text-slate-800">{supplier?.ice || 'Non renseigné'}</span></p>
                        {/* ✅ FIX: IF Native display on printed document */}
                        <p>IF: <span className="font-mono font-bold text-slate-800">{supplier?.identifiantFiscal || 'Non renseigné'}</span></p>
                        <p>Tél: <span className="font-mono font-bold text-slate-800">{supplier?.phone || 'Non renseigné'}</span></p>
                    </div>
                </div>
            </div>

            <table className="w-full mb-8 relative z-10">
              <thead className="bg-slate-50 text-slate-700 text-[10px] font-bold uppercase border-y border-slate-200">
                <tr><th className="py-3 px-3 text-left">Date</th><th className="py-3 px-3 text-left">Opération & Référence</th><th className="py-3 px-3 text-right">Débit (Règlements)</th><th className="py-3 px-3 text-right">Crédit (Achats)</th><th className="py-3 px-3 text-right">Solde</th></tr>
              </thead>
              <tbody className="text-xs">
                {(!statement || statement.length === 0) ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-bold">Aucune opération trouvée.</td></tr>
                ) : statement.map((item, index) => {
                    const safeType = item.type || 'DOCUMENT';
                    return (
                        <tr key={item.id || index} className="border-b border-slate-50">
                            <td className="py-3 px-3 font-mono text-slate-500">{formatDate(item.date)}</td>
                            <td className="py-3 px-3">
                                <div className="font-bold text-slate-800">{item.ref || '-'}</div>
                                <div className="text-[9px] text-slate-500 uppercase">
                                    {safeType === 'FACTURE_ACHAT' && !isLegal ? 'BON DE RÉCEPTION' : safeType.replace('_', ' ')}
                                </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-600">{item.debit > 0 ? formatMAD(item.debit) : '-'}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-600">{item.credit > 0 ? formatMAD(item.credit) : '-'}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-slate-900 bg-slate-50 border-l border-slate-100">{formatMAD(item.balance)}</td>
                        </tr>
                    );
                })}
              </tbody>
            </table>

            <div className="flex justify-end mt-auto relative z-10">
              <div className="w-[40%] flex flex-col items-end border-t border-slate-200 pt-4">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Solde Dû Actuel</p>
                  <p className="font-black text-2xl text-slate-900 bg-slate-50 p-2 rounded border border-slate-200">{formatMAD(finalBalance)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};