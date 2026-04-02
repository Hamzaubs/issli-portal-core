import React, { useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, MapPin, Phone, Mail } from 'lucide-react';

// 🛡️ CONVERTISSEUR CHIFFRES EN LETTRES (MAD)
const numberToFrenchWords = (num: number): string => {
    const units = ["", "Un", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept", "Huit", "Neuf", "Dix", "Onze", "Douze", "Treize", "Quatorze", "Quinze", "Seize", "Dix-Sept", "Dix-Huit", "Dix-Neuf"];
    const tens = ["", "Dix", "Vingt", "Trente", "Quarante", "Cinquante", "Soixante", "Soixante-Dix", "Quatre-Vingt", "Quatre-Vingt-Dix"];
    
    const convertLessThanOneThousand = (n: number): string => {
        if (n === 0) return "";
        let word = "";
        if (n >= 100) {
            word += (Math.floor(n / 100) === 1 ? "Cent " : units[Math.floor(n / 100)] + " Cent ");
            n %= 100;
        }
        if (n >= 20) {
            const tenObj = Math.floor(n / 10);
            const unitObj = n % 10;
            if (tenObj === 7 || tenObj === 9) {
                word += tens[tenObj - 1] + "-" + (unitObj === 1 ? "et-Onze " : units[10 + unitObj] + " ");
            } else {
                word += tens[tenObj] + (unitObj === 1 ? "-et-Un " : (unitObj > 0 ? "-" + units[unitObj] + " " : " "));
            }
        } else if (n > 0) {
            word += units[n] + " ";
        }
        return word;
    };

    if (num === 0) return "Zéro Dirham";

    const dirhams = Math.floor(num);
    const centimes = Math.round((num - dirhams) * 100);

    let result = "";
    if (dirhams >= 1000000) {
        result += convertLessThanOneThousand(Math.floor(dirhams / 1000000)) + "Million ";
        num %= 1000000;
    }
    if (dirhams >= 1000) {
        const thousands = Math.floor((dirhams % 1000000) / 1000);
        if (thousands === 1) result += "Mille ";
        else result += convertLessThanOneThousand(thousands) + "Mille ";
    }
    result += convertLessThanOneThousand(dirhams % 1000);
    
    let finalStr = result.trim() + (dirhams > 1 ? " Dirhams" : " Dirham");
    
    if (centimes > 0) {
        finalStr += " et " + convertLessThanOneThousand(centimes).trim() + (centimes > 1 ? " Centimes" : " Centime");
    }
    
    return finalStr.toUpperCase();
};

export const PurchasePrint = ({ purchase, onClose }: { purchase: any; onClose: () => void }) => {
  const componentRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: componentRef, documentTitle: `Document_${purchase.reference}` });
  
  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount || 0);
  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  
  const isBonCommande = purchase.type === 'BON_COMMANDE';
  const title = purchase.type.replace('_', ' '); // E.g., FACTURE ACHAT or BON COMMANDE

  // SAFELY ROUNDED VAT BREAKDOWN
  const vatBreakdown = useMemo(() => {
    const breakdown: Record<number, { base: number; amount: number }> = { 0.20: { base: 0, amount: 0 }, 0.10: { base: 0, amount: 0 }, 0.14: { base: 0, amount: 0 } }; 
    (purchase.items || []).forEach((item: any) => {
        const rate = Number(item.vatRateSnapshot || 0.20);
        const price = Number(item.unitPriceHT || 0);
        const qty = Number(item.quantity);
        
        const lineBase = Math.round((price * qty) * 100) / 100; 
        const lineVat = Math.round((lineBase * rate) * 100) / 100;

        if (Math.abs(rate - 0.20) < 0.01) { breakdown[0.20].base += lineBase; breakdown[0.20].amount += lineVat; } 
        else if (Math.abs(rate - 0.10) < 0.01) { breakdown[0.10].base += lineBase; breakdown[0.10].amount += lineVat; }
        else if (Math.abs(rate - 0.14) < 0.01) { breakdown[0.14].base += lineBase; breakdown[0.14].amount += lineVat; }
    });
    return breakdown;
  }, [purchase.items]);

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-100 w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-700">
        
        {/* TOOLBAR */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-50">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Printer size={20} className="text-indigo-800" /> 
              <span>APERÇU DOCUMENT (ACHATS)</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-indigo-800 text-white hover:bg-indigo-900 px-6 py-2 rounded-lg font-bold transition-all shadow-lg"><Printer size={18} /> IMPRIMER</button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><X size={24} /></button>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="flex-1 overflow-auto bg-slate-200 p-8 flex justify-center">
          <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] text-slate-900 relative text-sm shadow-xl flex flex-col">
            <style>{`@media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

            {/* HEADER - MATCHING YOUR BRANDING */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900 relative z-10">
                <div className="w-[60%]">
                    <div className="mb-4">
                        <h1 className="text-4xl font-black tracking-tighter text-emerald-800 leading-none print:text-emerald-800">
                            ISSLI PECHE <span className="text-xl font-medium text-slate-500 tracking-normal ml-1">S.A.R.L</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="h-1.5 w-10 bg-emerald-600 rounded-full print:bg-emerald-600"></div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Équipement Marine</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 space-y-1 pl-1 border-l-2 border-slate-100">
                      <div className="flex items-center gap-2 pl-2"><MapPin size={12} className="text-slate-400"/> 19, Rue Bni Aamir - Bourgogne - Casablanca</div>
                      <div className="flex items-center gap-2 pl-2"><Phone size={12} className="text-slate-400"/> Tél/Fax : +212 5 22 20 51 96</div>
                      <div className="flex items-center gap-2 pl-2"><Mail size={12} className="text-slate-400"/> isslipeche@yahoo.fr</div>
                    </div>
                </div>
                <div className="text-right">
                  <h2 className={`text-3xl font-light uppercase tracking-wide mb-1 ${isBonCommande ? 'text-indigo-600' : 'text-slate-800'}`}>{title}</h2>
                  <p className="text-slate-900 font-bold text-lg">Réf: {purchase.reference}</p>
                  <p className="text-slate-500 text-xs mt-1">Date : {formatDate(purchase.issuedAt)}</p>
                </div>
            </div>

            {/* SUPPLIER BOX (Replaces Client Box) */}
            <div className="flex justify-end mb-10 relative z-10">
                <div className="w-[50%] bg-slate-50 rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-2 print:text-indigo-700">Fournisseur</p>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{purchase.supplierNameSnapshot || purchase.supplier?.name}</h3>
                    <div className="text-[11px] text-slate-600 space-y-1">
                        <p>ICE: <span className="font-mono font-bold text-slate-800">{purchase.supplierIceSnapshot || purchase.supplier?.ice || '-'}</span></p>
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <table className="w-full mb-8 relative z-10">
              <thead className="bg-slate-100 text-slate-900 text-[10px] font-bold uppercase border-y border-slate-200 print:bg-slate-100">
                <tr><th className="py-3 px-3 text-left">Désignation</th><th className="py-3 px-3 text-center">Qté</th><th className="py-3 px-3 text-right">P.U. HT</th><th className="py-3 px-3 text-right">Total HT</th></tr>
              </thead>
              <tbody className="text-xs">
                {(purchase.items || []).map((item: any) => {
                    const price = Number(item.unitPriceHT || 0);
                    const qty = Number(item.quantity);
                    return (
                        <tr key={item.id} className="border-b border-slate-50">
                            <td className="py-3 px-3 font-bold text-slate-800">{item.productName}</td>
                            <td className="py-3 px-3 text-center font-bold">{qty}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">{formatMAD(Math.abs(price))}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatMAD(Math.abs(price * qty))}</td>
                        </tr>
                    );
                })}
              </tbody>
            </table>

            {/* FOOTER AREA */}
            <div className="flex justify-between items-start mt-auto relative z-10">
              {/* LEFT: VAT */}
              <div className="w-[50%] text-[10px]">
                    <p className="font-bold text-slate-800 uppercase text-[9px] mb-2">Récapitulatif TVA</p>
                    <table className="w-full text-slate-600 mb-6 border border-slate-200 rounded overflow-hidden">
                      <thead className="bg-slate-50 font-bold text-slate-800"><tr><th className="p-2 text-left">Taux</th><th className="p-2 text-right">Base HT</th><th className="p-2 text-right">Montant TVA</th></tr></thead>
                      <tbody>
                          {vatBreakdown[0.20].amount > 0 && <tr className="border-t border-slate-100"><td className="p-2 font-bold">20%</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.20].base)}</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.20].amount)}</td></tr>}
                          {vatBreakdown[0.10].amount > 0 && <tr className="border-t border-slate-100"><td className="p-2 font-bold">10%</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.10].base)}</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.10].amount)}</td></tr>}
                          {vatBreakdown[0.14].amount > 0 && <tr className="border-t border-slate-100"><td className="p-2 font-bold">14%</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.14].base)}</td><td className="p-2 text-right font-mono">{formatMAD(vatBreakdown[0.14].amount)}</td></tr>}
                      </tbody>
                    </table>
              </div>

              {/* RIGHT: TOTALS */}
              <div className="w-[40%] flex flex-col items-end">
                  <div className="w-full space-y-2 mb-6 text-sm">
                    <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-1"><span>Total HT</span><span className="font-bold text-slate-800">{formatMAD(Math.abs(purchase.totalHT))}</span></div>
                    <div className="flex justify-between text-slate-500 border-b border-slate-100 pb-1"><span>Total TVA</span><span className="font-bold text-slate-800">{formatMAD(Math.abs(purchase.totalTTC - purchase.totalHT))}</span></div>
                    
                    <div className="flex justify-between items-center p-2 rounded-lg mt-2 border border-slate-300 bg-slate-50 print:bg-slate-50">
                        <span className="font-bold uppercase text-xs text-slate-800">Total TTC</span>
                        <span className="font-black text-xl text-slate-900">{formatMAD(Math.abs(purchase.totalTTC))}</span>
                    </div>
                  </div>
              </div>
            </div>

            {/* AMOUNT IN WORDS */}
            <div className="mt-4 mb-2 p-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 text-center">
                Arrêté {isBonCommande ? 'le présent bon de commande' : 'le présent document'} à la somme de :<br/>
                <span className="text-sm font-black text-slate-900 mt-1 block uppercase">{numberToFrenchWords(Math.abs(purchase.totalTTC))}</span>
            </div>

            {/* LEGAL FOOTER */}
            <div className="mt-2">
                {purchase.note && <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 italic"><strong>Note:</strong> {purchase.note}</div>}
                
                {isBonCommande ? (
                    <div className="flex justify-between mt-6 pt-6 border-t border-slate-200">
                        <div className="w-64 h-24 border border-slate-300 rounded-lg p-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                            Signature & Cachet (ISSLI PECHE)
                        </div>
                    </div>
                ) : null}

                <div className="text-center text-[8px] text-slate-500 border-t-2 border-emerald-800/20 pt-3 mt-4 leading-relaxed">
                    <p className="font-bold text-emerald-800 uppercase mb-1 print:text-emerald-800">ISSLI PECHE S.A.R.L - Société à Responsabilité Limitée au capital de 1 500 000 MAD</p>
                    <div className="flex justify-center gap-3 flex-wrap">
                        <span><strong>RC:</strong> 124637 (Casablanca)</span><span className="text-slate-300">|</span>
                        <span><strong>IF:</strong> 1921313</span><span className="text-slate-300">|</span>
                        <span><strong>ICE:</strong> 001664837000074</span><span className="text-slate-300">|</span>
                        <span><strong>Patente:</strong> 35420113</span><span className="text-slate-300">|</span>
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