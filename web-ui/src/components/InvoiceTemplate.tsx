// web-ui/src/components/InvoiceTemplate.tsx
import React from 'react';

interface InvoiceTemplateProps {
  data: any;
  settings?: any; 
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(({ data }, ref) => {
  if (!data) return null;

  const isQuote = data.type === 'DEVIS';
  const isCredit = data.type === 'AVOIR';
  
  const clientName = data.clientNameSnapshot || data.client?.name || "Client Inconnu";
  const clientIce = data.clientIceSnapshot || data.client?.ice || "";
  const clientAddress = data.client?.address || "";
  const clientCity = data.client?.city || "";

  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

  const getUnitLabel = (unit?: string) => { 
      switch(unit) { 
          case 'M': return 'm'; 
          case 'KG': return 'kg'; 
          case 'L': return 'L'; 
          case 'UNIT': default: return 'u'; 
      } 
  };

  const consolidatedItems = data.items.reduce((acc: any[], item: any) => {
      const rate = Number(item.vatRateSnapshot !== undefined ? item.vatRateSnapshot : (item.vatRate || 0.20));
      const price = Number(item.unitPriceHT || item.unitPrice || 0);
      
      const existing = acc.find(i => i.productName === item.productName && i.parsedRate === rate && i.parsedPrice === price);
      if (existing) {
          existing.quantity = Number(existing.quantity) + Number(item.quantity);
      } else {
          acc.push({ ...item, quantity: Number(item.quantity), parsedRate: rate, parsedPrice: price });
      }
      return acc;
  }, []);

  const totalHT = Number(data.totalHT);
  const totalTTC = Number(data.totalTTC);
  const totalVAT = totalTTC - totalHT;

  return (
    <div ref={ref} className="bg-white px-[15mm] pt-[45mm] pb-[15mm] w-[210mm] mx-auto text-slate-900 font-sans relative" style={{ minHeight: '297mm' }}>
      
      {/* LETTERHEAD READY HEADER */}
      <div className="flex justify-end items-start pb-6 mb-8">
        <div className="text-right">
          <h2 className={`text-5xl font-black uppercase tracking-tighter ${isCredit ? 'text-red-600' : isQuote ? 'text-amber-500' : 'text-slate-800'}`}>
            {isCredit ? 'AVOIR' : isQuote ? 'DEVIS' : 'FACTURE'}
          </h2>
          <p className="text-xl font-bold text-slate-400 mt-2">#{data.reference}</p>
          <p className="text-sm font-bold text-slate-800 mt-1">Date: {new Date(data.issuedAt).toLocaleDateString('fr-MA')}</p>
        </div>
      </div>

      {/* CLIENT INFO */}
      <div className="flex justify-start mb-12">
        <div className="w-[55%] bg-slate-50 p-6 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Facturé à</p>
          <h3 className="text-2xl font-black text-slate-900 mb-2">{clientName}</h3>
          <div className="text-sm text-slate-600 space-y-1">
             {clientAddress && <p>{clientAddress}</p>}
             {clientCity && <p>{clientCity}</p>}
             {clientIce && <p className="font-mono font-bold mt-2 pt-2 border-t border-slate-200">ICE: {clientIce}</p>}
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <table className="w-full mb-8">
        <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-bold border-y border-slate-200">
          <tr>
            <th className="py-3 px-4 text-left">Désignation</th>
            <th className="py-3 px-4 text-center">Qté</th>
            <th className="py-3 px-4 text-center">TVA</th> 
            <th className="py-3 px-4 text-right">P.U (HT)</th>
            <th className="py-3 px-4 text-right">Total (HT)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {consolidatedItems.map((item: any, idx: number) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="py-3 px-4 font-bold text-slate-700">{item.productName}</td>
                <td className="py-3 px-4 text-center font-mono">{item.quantity} <span className="text-[10px] text-slate-500">{getUnitLabel(item.measureUnit)}</span></td>
                <td className="py-3 px-4 text-center font-mono">{Math.round(item.parsedRate * 100)}%</td>
                <td className="py-3 px-4 text-right font-mono">{formatMAD(item.parsedPrice)}</td>
                <td className="py-3 px-4 text-right font-bold">{formatMAD(item.quantity * item.parsedPrice)}</td>
              </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALS */}
      <div className="flex justify-end mt-auto">
        <div className="w-[40%] space-y-2">
          <div className="flex justify-between text-sm font-bold text-slate-500 py-2 border-b border-slate-100">
            <span>Total HT</span>
            <span>{formatMAD(totalHT)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-500 py-2 border-b border-slate-100">
            <span>Total TVA</span> 
            <span>{formatMAD(totalVAT)}</span>
          </div>
          <div className="flex justify-between text-2xl font-black text-slate-900 pt-4 bg-slate-50 p-2 rounded border border-slate-200 mt-2">
            <span>Net à Payer</span>
            <span>{formatMAD(totalTTC)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 mb-2 p-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 text-center">
          Arrêté {isQuote ? 'le présent devis' : isCredit ? 'le présent avoir' : 'la présente facture'} à la somme de :<br/>
          <span className="text-sm font-black text-slate-900 mt-1 block uppercase">{formatMAD(totalTTC)}</span>
      </div>

      {/* INTENTIONALLY BLANK BOTTOM FOR PRE-PRINTED FOOTER */}
    </div>
  );
});

InvoiceTemplate.displayName = "InvoiceTemplate";