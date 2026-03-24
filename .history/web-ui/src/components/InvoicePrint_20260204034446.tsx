// web-ui/src/components/InvoicePrint.tsx
import React, { useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, MapPin, Phone, Mail } from 'lucide-react';

interface InvoiceItem {
  id: string; name: string; productName?: string; quantity: number; unitPrice: number; unitPriceHT?: number; total: number; measureUnit?: string; technicalSpecs?: string; product?: { vatRate: number }; 
}

interface Invoice {
  id: string; reference: string; type?: string; status?: string; issuedAt: string; totalHT: number; totalTTC: number; 
  amountPaid?: number; note?: string;
  payments?: { method: string, amount: number, reference?: string, paidAt: string }[];
  client: { name: string; ice: string; address?: string; rc?: string; city?: string };
  items: InvoiceItem[];
}

export const InvoicePrint = ({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) => {
  const componentRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: componentRef, documentTitle: `Document_${invoice.reference}` });
  
  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount || 0);
  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  const getUnitLabel = (unit?: string) => { switch(unit) { case 'M': return 'm'; case 'KG': return 'kg'; case 'L': return 'L'; case 'UNIT': default: return 'u'; } };
  
  const isCreditNote = invoice.type === 'AVOIR';
  const isDevis = invoice.type === 'DEVIS';
  const isCancelled = invoice.status === 'ANNULEE' || invoice.status === 'REJETE';
  
  const title = isDevis ? 'DEVIS' : isCreditNote ? 'AVOIR' : 'FACTURE';
  const remaining = invoice.totalTTC - (Number(invoice.amountPaid) || 0);
  
  // Vat logic
  const vatBreakdown = useMemo(() => {
    const breakdown = { 0.20: { base: 0, amount: 0 }, 0.10: { base: 0, amount: 0 }, 0.14: { base: 0, amount: 0 } }; 
    (invoice.items || []).forEach(item => {
        const rate = (item.product?.vatRate) || 0.20; 
        const lineBase = Math.abs(item.total || (item.quantity * (item.unitPrice || item.unitPriceHT || 0))); 
        
        if (Math.abs(rate - 0.20) < 0.01) { breakdown[0.20].base += lineBase; breakdown[0.20].amount += lineBase * 0.20; } 
        else if (Math.abs(rate - 0.10) < 0.01) { breakdown[0.10].base += lineBase; breakdown[0.10].amount += lineBase * 0.10; }
        else if (Math.abs(rate - 0.14) < 0.01) { breakdown[0.14].base += lineBase; breakdown[0.14].amount += lineBase * 0.14; }
    });
    return breakdown;
  }, [invoice.items]);

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-100 w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-700">
        
        {/* TOOLBAR */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-50">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Printer size={20} className="text-blue-900" /> 
              <span>APERÇU DOCUMENT (STOCK A)</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-6 py-2 rounded-lg font-bold transition-all shadow-lg"><Printer size={18} /> IMPRIMER</button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><X size={24} /></button>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center">
          <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] text-slate-900 relative text-sm shadow-xl flex flex-col">
            <style>{`@media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; } }`}</style>
            
            {isCancelled && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"><div className="border-[8px] border-red-500/20 text-red-500/20 text-[8rem] font-black uppercase -rotate-45 p-10 rounded-3xl">{invoice.status}</div></div>}

            {/* HEADER */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900 relative z-10">
                <div className="w-[60%]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-14 h-14 bg-blue-900 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">LOGO</div>
                        <div>
                            <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">ISSLI PECHE <span className="text-sm font-bold text-slate-500">S.A.R.L</span></h1>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Équipement Marine</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-1 pl-1">
                      <div className="flex items-center gap-2"><MapPin size={12} className="text-slate-400"/> 19, Rue Bni Aamir - Bourgogne - Casablanca</div>
                      <div className="flex items-center gap-2"><Phone size={12} className="text-slate-400"/> Tél/Fax : +212 5 22 20 51 96</div>
                      <div className="flex items-center gap-2"><Mail size={12} className="text-slate-400"/> isslipeche@yahoo.fr</div>
                    </div>
                </div>
                <div className="text-right">
                  <h2 className={`text-4xl font-light uppercase tracking-wide mb-1 ${isCreditNote ? 'text-red-600' : isDevis ? 'text-amber-600' : 'text-slate-800'}`}>{title}</h2>
                  <p className="text-slate-900 font-bold text-lg">N° {invoice.reference}</p>
                  <p className="text-slate-500 text-xs mt-1">Date : {formatDate(invoice.issuedAt)}</p>
                </div>
            </div>

            {/* CLIENT BOX */}
            <div className="flex justify-end mb-10 relative z-10">
                <div className="w-[50%] bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Facturé à</p>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{invoice.client.name}</h3>
                    <div className="text-[11px] text-slate-600 space-y-1">
                        <p>ICE: <span className="font-mono font-bold text-slate-800">{invoice.client.ice || '-'}</span></p>
                        {invoice.client.rc && <p>RC: {invoice.client.rc}</p>}
                        {invoice.client.address && <p className="opacity-80">{invoice.client.address}</p>}
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <table className="w-full mb-8 relative z-10">
              <thead className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase border-y border-slate-200">
                <tr><th className="py-3 px-3 text-left">Désignation</th><th className="py-3 px-3 text-center">Qté</th><th className="py-3 px-3 text-right">P.U. HT</th><th className="py-3 px-3 text-right">Total HT</th></tr>
              </thead>
              <tbody className="text-xs">
                {(invoice.items || []).map((item) => (
                  <tr key={item.id} className="border-b border-slate-50">
                    <td className="py-3 px-3"><p className="font-bold text-slate-800">{item.productName || item.name}</p>{item.technicalSpecs && <span className="text-[9px] text-slate-500 italic block mt-0.5">{item.technicalSpecs}</span>}</td>
                    <td className="py-3 px-3 text-center"><span className="font-bold">{item.quantity}</span><span className="text-[9px] text-slate-400 ml-1">{getUnitLabel(item.measureUnit)}</span></td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">{formatMAD(Math.abs(item.unitPrice || item.unitPriceHT || 0))}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatMAD(Math.abs(item.total || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* FOOTER AREA */}
            <div className="flex justify-between items-start mt-auto relative z-10">
              <div className="w-[50%] text-[10px]">
                    <p className="font-bold text-slate-400 uppercase text-[9px] mb-2">Récapitulatif TVA</p>
                    <table className="w-full text-slate-600 mb-6 border border-slate-200 rounded overflow-hidden">
                      <thead className="bg-slate-50 font-bold text-slate-800"><tr><th className="p-2 text-left">Taux</th><th className="p-2 text-right">Base HT</th><th className="p-2 text-right">Montant TVA</th></tr></thead>
                      <tbody>
                          {vatBreakdown[0.20].amount > 0 && <tr className="border-t border-slate-100"><td className="p-2 font-bold">20%</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.20].base)}</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.20].amount)}</td></tr>}
                          {vatBreakdown[0.10].amount > 0 && <tr className="border-t border-slate-100"><td className="p-2 font-bold">10%</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.10].base)}</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.10].amount)}</td></tr>}
                          {vatBreakdown[0.14].amount > 0 && <tr className="border-t border-slate-100"><td className="p-2 font-bold">14%</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.14].base)}</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.14].amount)}</td></tr>}
                      </tbody>
                    </table>
              </div>

              <div className="w-[40%] flex flex-col items-end">
                  <div className="w-full space-y-2 mb-6 text-sm">
                    <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-1"><span>Total HT</span><span className="font-bold text-slate-800">{formatMAD(Math.abs(invoice.totalHT))}</span></div>
                    <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-1"><span>Total TVA</span><span className="font-bold text-slate-800">{formatMAD(Math.abs(invoice.totalTTC - invoice.totalHT))}</span></div>
                    
                    {/* TOTAL BLOCK */}
                    <div className={`flex justify-between items-center bg-slate-100 p-2 rounded-lg mt-2 border ${isCreditNote ? 'border-red-200' : 'border-slate-200'}`}>
                        <span className={`font-bold uppercase text-xs ${isCreditNote ? 'text-red-700' : 'text-slate-700'}`}>{isCreditNote ? 'Total Avoir' : 'Total TTC'}</span>
                        <span className={`font-black text-xl ${isCreditNote ? 'text-red-600' : 'text-slate-900'}`}>{formatMAD(Math.abs(invoice.totalTTC))}</span>
                    </div>

                    {/* PAYMENT STATUS */}
                    {!isCreditNote && !isDevis && (
                        <div className="pt-2 border-t border-slate-100 mt-2">
                            <div className="flex justify-between text-xs text-emerald-600 font-bold mb-1">
                                <span>Déjà Réglé</span>
                                <span>{formatMAD(invoice.amountPaid || 0)}</span>
                            </div>
                            {remaining > 0.5 ? (
                                <div className="flex justify-between text-sm text-red-600 font-black">
                                    <span>Reste à Payer</span>
                                    <span>{formatMAD(remaining)}</span>
                                </div>
                            ) : (
                                <div className="text-center bg-emerald-100 text-emerald-700 text-xs font-bold py-1 rounded mt-1 border border-emerald-200 uppercase tracking-widest">
                                    Facture Soldée
                                </div>
                            )}
                        </div>
                    )}
                  </div>
              </div>
            </div>

            {/* NOTE & LEGAL FOOTER */}
            <div className="mt-8">
                {invoice.note && <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 italic"><strong>Note:</strong> {invoice.note}</div>}
                
                {isDevis ? (
                    <div className="flex justify-between mt-8 pt-8 border-t border-slate-200">
                        <div className="text-xs text-slate-500 italic">Offre valable 15 jours.</div>
                        <div className="w-64 h-24 border border-slate-300 rounded-lg p-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                            Bon pour accord (Signature & Cachet)
                        </div>
                    </div>
                ) : null}

                <div className="text-center text-[8px] text-slate-500 border-t-2 border-slate-200 pt-3 mt-4 leading-relaxed">
                    <p className="font-bold text-slate-700 uppercase mb-1">ISSLI PECHE S.A.R.L - Société à Responsabilité Limitée au capital de 1 500 000 MAD</p>
                    <div className="flex justify-center gap-3 flex-wrap">
                        <span><strong>RC:</strong> 124637 (Casablanca)</span>
                        <span className="text-slate-300">|</span>
                        <span><strong>IF:</strong> 1921313</span>
                        <span className="text-slate-300">|</span>
                        <span><strong>ICE:</strong> 001664837000074</span>
                        <span className="text-slate-300">|</span>
                        <span><strong>Patente:</strong> 35420113</span>
                        <span className="text-slate-300">|</span>
                        <span><strong>CNSS:</strong> 6598778</span>
                    </div>
                    <p className="mt-1 text-slate-400">19, Rue Bni Aamir - Bourgogne - Casablanca • Maroc</p>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};