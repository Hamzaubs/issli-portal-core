import React from 'react';

interface InvoiceTemplateProps {
  data: any;
  settings?: any; 
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceTemplateProps>(({ data, settings }, ref) => {
  if (!data) return null;

  const isQuote = data.type === 'DEVIS';
  const isCredit = data.type === 'AVOIR';
  
  // Client Logic
  const clientName = data.clientNameSnapshot || data.client?.name || "Client Inconnu";
  const clientIce = data.clientIceSnapshot || data.client?.ice || "";
  const clientAddress = data.client?.address || "";
  const clientCity = data.client?.city || "";

  // Company Logic (Defaults)
  const companyName = settings?.name || "MA SOCIETE";
  const companyIce = settings?.ice || "";
  const companyPhone = settings?.phone || "";
  const companyAddress = settings?.address || "";
  const companyEmail = settings?.email || "";

  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);

  // Totals
  const totalHT = Number(data.totalHT);
  const totalTTC = Number(data.totalTTC);
  const totalVAT = totalTTC - totalHT;

  return (
    <div ref={ref} className="bg-white p-10 max-w-[210mm] mx-auto text-slate-900 font-sans" style={{ minHeight: '297mm' }}>
      
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight uppercase mb-2">{companyName}</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Facture Officielle</p>
          <div className="mt-4 text-xs font-medium text-slate-600 space-y-1">
            {companyAddress && <p>{companyAddress}</p>}
            {companyPhone && <p>Tél: {companyPhone}</p>}
            {companyEmail && <p>Email: {companyEmail}</p>}
            {companyIce && <p>ICE: {companyIce}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className={`text-5xl font-black uppercase tracking-tighter ${isCredit ? 'text-red-600' : isQuote ? 'text-amber-500' : 'text-blue-600'}`}>
            {isCredit ? 'AVOIR' : isQuote ? 'DEVIS' : 'FACTURE'}
          </h2>
          <p className="text-xl font-bold text-slate-400 mt-2">#{data.reference}</p>
          <p className="text-sm font-bold text-slate-800 mt-1">Date: {new Date(data.issuedAt).toLocaleDateString('fr-MA')}</p>
        </div>
      </div>

      {/* CLIENT INFO */}
      <div className="flex justify-end mb-12">
        <div className="w-1/2 bg-slate-50 p-6 rounded-xl border border-slate-200">
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
        <thead className="bg-slate-900 text-white uppercase text-xs font-bold">
          <tr>
            <th className="py-3 px-4 text-left rounded-tl-lg">Désignation</th>
            <th className="py-3 px-4 text-center">Qté</th>
            {/* ✅ NEW COMPLIANCE COLUMN */}
            <th className="py-3 px-4 text-center">TVA</th> 
            <th className="py-3 px-4 text-right">P.U (HT)</th>
            <th className="py-3 px-4 text-right rounded-tr-lg">Total (HT)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {data.items.map((item: any, idx: number) => {
            const rate = Number(item.vatRateSnapshot || item.vatRate || 0.20);
            return (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="py-3 px-4 text-sm font-bold text-slate-700">{item.productName}</td>
                <td className="py-3 px-4 text-center text-sm font-mono">{item.quantity}</td>
                {/* ✅ DISPLAY VAT RATE PER LINE */}
                <td className="py-3 px-4 text-center text-sm font-mono">{Math.round(rate * 100)}%</td>
                <td className="py-3 px-4 text-right text-sm font-mono">{formatMAD(Number(item.unitPriceHT))}</td>
                <td className="py-3 px-4 text-right text-sm font-bold">{formatMAD(item.quantity * Number(item.unitPriceHT))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TOTALS */}
      <div className="flex justify-end">
        <div className="w-1/2 space-y-2">
          <div className="flex justify-between text-sm font-bold text-slate-500 py-2 border-b border-slate-100">
            <span>Total HT</span>
            <span>{formatMAD(totalHT)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-500 py-2 border-b border-slate-100">
            <span>Total TVA</span> 
            <span>{formatMAD(totalVAT)}</span>
          </div>
          <div className="flex justify-between text-2xl font-black text-slate-900 pt-4">
            <span>Net à Payer</span>
            <span>{formatMAD(totalTTC)}</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="absolute bottom-10 left-10 right-10 text-center text-[10px] text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-4">
        Arrêté la présente facture à la somme de : {formatMAD(totalTTC)}
        <br/>
        Merci de votre confiance
      </div>

    </div>
  );
});

InvoiceTemplate.displayName = "InvoiceTemplate";