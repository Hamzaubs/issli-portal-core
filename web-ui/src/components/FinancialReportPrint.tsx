import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, FileText, Briefcase, Building2 } from 'lucide-react';

interface Props {
    data: any; 
    period: { from: string; to: string };
    onClose: () => void;
}

export const FinancialReportPrint: React.FC<Props> = ({ data, period, onClose }) => {
    const componentRef = useRef(null);
    
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Bilan_Financier_${period.from}_${period.to}`,
    });

    const formatMAD = (n: number) => {
        if (n === undefined || n === null) return '0.00';
        return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);
    };

    const { kpi, treasury } = data || {};
    const netRevenue = kpi?.netRevenue || 0;
    const totalTva = kpi?.taxAnalysis?.totalTva || 0;
    const refundedVAT = kpi?.refundedVAT || 0;
    
    const totalTTC = netRevenue + totalTva;
    const totalTreasury = treasury ? treasury.reduce((acc: number, t: any) => acc + t.total, 0) : 0;

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-200 w-full max-w-4xl h-[90vh] rounded-xl flex flex-col overflow-hidden shadow-2xl">
                
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <Briefcase className="text-blue-400" />
                        <span className="font-bold uppercase tracking-wider">Bilan Financier (Synthèse)</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handlePrint()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><Printer size={18}/> Imprimer</button>
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors"><X size={18}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-100">
                    <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[20mm] text-slate-900 shadow-xl relative font-sans flex flex-col">
                        
                        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                            <div>
                                <h1 className="text-3xl font-black uppercase text-slate-900 mb-2 tracking-tight">Bilan Périodique</h1>
                                <p className="text-sm font-medium text-slate-500 uppercase">Du {new Date(period.from).toLocaleDateString('fr-MA')} au {new Date(period.to).toLocaleDateString('fr-MA')}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="font-bold text-xl text-blue-900">ISSLI PECHE</h2>
                                <p className="text-xs text-slate-500 mt-1">ICE: 001664837000074</p>
                                <p className="text-xs text-slate-500">IF: 01921313</p>
                            </div>
                        </div>

                        <div className="mb-10">
                            <h3 className="text-sm font-black uppercase text-blue-900 border-b border-blue-200 pb-2 mb-4 flex items-center gap-2">
                                <FileText size={16}/> I. Performance Commerciale
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Chiffre d'Affaires HT</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">{formatMAD(netRevenue)}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <p className="text-xs font-bold text-slate-400 uppercase">TVA Facturée</p>
                                    <p className="text-xl font-black text-slate-900 mt-1">{formatMAD(totalTva)}</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <p className="text-xs font-bold text-blue-600 uppercase">Total TTC Généré</p>
                                    <p className="text-xl font-black text-blue-900 mt-1">{formatMAD(totalTTC)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-10">
                            <h3 className="text-sm font-black uppercase text-emerald-800 border-b border-emerald-200 pb-2 mb-4 flex items-center gap-2">
                                <Building2 size={16}/> II. Encaissements & Trésorerie
                            </h3>
                            <table className="w-full text-sm border-collapse border border-slate-200">
                                <thead className="bg-emerald-50 text-emerald-900 font-bold">
                                    <tr>
                                        <th className="border border-slate-200 p-2 text-left">Mode de Règlement</th>
                                        <th className="border border-slate-200 p-2 text-right">Montant Encaissé</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {treasury && treasury.length > 0 ? (
                                        treasury.map((t: any, i: number) => (
                                            <tr key={i}>
                                                <td className="border border-slate-200 p-2 font-medium">
                                                    {t.method === 'CASH' ? 'Espèces (Caisse)' : 
                                                     t.method === 'CHEQUE' ? 'Chèques' : 
                                                     t.method === 'VIREMENT' ? 'Virements Bancaires' : 
                                                     t.method === 'LIVRAISON' ? 'Retours Livraison' : t.method}
                                                </td>
                                                <td className="border border-slate-200 p-2 text-right font-mono">{formatMAD(t.total)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={2} className="p-4 text-center text-slate-400 italic">Aucun encaissement sur la période</td></tr>
                                    )}
                                    <tr className="bg-slate-100 font-black">
                                        <td className="border border-slate-200 p-2 text-right">TOTAL ENCAISSEMENTS</td>
                                        <td className="border border-slate-200 p-2 text-right">
                                            {formatMAD(totalTreasury)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-10">
                            <h3 className="text-sm font-black uppercase text-amber-700 border-b border-amber-200 pb-2 mb-4">III. Synthèse Fiscale (TVA)</h3>
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-amber-700 uppercase mb-1">Détail des Taxes</p>
                                    <div className="text-sm space-y-1">
                                        <p>TVA 20%: <span className="font-bold">{formatMAD(kpi?.taxAnalysis?.tva20)}</span></p>
                                        <p>TVA 10%: <span className="font-bold">{formatMAD(kpi?.taxAnalysis?.tva10)}</span></p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Net à Verser (Estimé)</p>
                                    <p className="text-2xl font-black text-slate-900">{formatMAD(totalTva - refundedVAT)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-10 flex justify-between text-xs">
                            <div className="text-center w-1/3">
                                <p className="font-bold uppercase mb-8">Service Comptabilité</p>
                                <div className="h-px bg-slate-300 w-full"></div>
                            </div>
                            <div className="text-center w-1/3">
                                <p className="font-bold uppercase mb-8">Direction Générale</p>
                                <div className="h-px bg-slate-300 w-full"></div>
                            </div>
                        </div>

                        <div className="absolute bottom-[10mm] left-0 right-0 text-center text-[8px] text-slate-400">
                            Rapport généré par ISSLI PECHE ERP - Usage interne strict.
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};