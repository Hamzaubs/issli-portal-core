// web-ui/src/components/VATReportPrint.tsx
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, FileText, Calendar } from 'lucide-react';

interface VATProps {
    data: any; 
    period: { from: string; to: string };
    onClose: () => void;
}

export const VATReportPrint: React.FC<VATProps> = ({ data, period, onClose }) => {
    const componentRef = useRef(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Declaration_TVA_${period.from}`,
    });

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n || 0);
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-MA') : '-';
    
    // Safe Access
    const kpi = data?.kpi || {};
    const tax = kpi.taxAnalysis || { tva20: 0, tva10: 0, totalTva: 0 };
    const netRevenue = Number(kpi.netRevenue) || 0;
    const refundedVAT = Number(kpi.refundedVAT) || 0;
    const netToPay = (Number(tax.totalTva) || 0) - refundedVAT;

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-200 w-full max-w-4xl h-[90vh] rounded-xl flex flex-col overflow-hidden shadow-2xl">
                
                {/* TOOLBAR */}
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="text-amber-500" />
                        <span className="font-bold uppercase tracking-wider">État TVA (Officiel)</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handlePrint()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Printer size={18}/> Imprimer</button>
                        <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg"><X size={18}/></button>
                    </div>
                </div>

                {/* DOCUMENT PREVIEW */}
                <div className="flex-1 overflow-auto p-8 flex justify-center bg-gray-100">
                    <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[20mm] text-slate-900 shadow-xl relative font-sans">
                        
                        {/* HEADER */}
                        <div className="text-center border-b-2 border-black pb-6 mb-8">
                            <h1 className="text-2xl font-black uppercase mb-2">État Synthétique de la TVA</h1>
                            <p className="text-sm font-medium uppercase">Période du {formatDate(period.from)} au {formatDate(period.to)}</p>
                            <p className="text-xs mt-2 text-slate-500">ISSLI PECHE S.A.R.L - IF: 01921313 - ICE: 001664837000074</p>
                        </div>

                        {/* SECTION 1: CHIFFRES D'AFFAIRES */}
                        <div className="mb-8">
                            <h2 className="text-sm font-black uppercase bg-slate-100 p-2 border-y border-black mb-4">I. Chiffre d'Affaires Imposable</h2>
                            <table className="w-full text-sm border-collapse border border-slate-300">
                                <thead>
                                    <tr className="bg-slate-50 text-xs">
                                        <th className="border border-slate-300 p-2 text-left">Désignation</th>
                                        <th className="border border-slate-300 p-2 text-right w-32">Base HT</th>
                                        <th className="border border-slate-300 p-2 text-right w-24">Taux</th>
                                        <th className="border border-slate-300 p-2 text-right w-32">Taxe Exigible</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-slate-300 p-2">Ventes de marchandises (Taux Normal)</td>
                                        <td className="border border-slate-300 p-2 text-right font-mono">{formatMAD(tax.tva20 * 5)}</td>
                                        <td className="border border-slate-300 p-2 text-center">20%</td>
                                        <td className="border border-slate-300 p-2 text-right font-mono font-bold">{formatMAD(tax.tva20)}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-slate-300 p-2">Ventes de marchandises (Taux Réduit)</td>
                                        <td className="border border-slate-300 p-2 text-right font-mono">{formatMAD(tax.tva10 * 10)}</td>
                                        <td className="border border-slate-300 p-2 text-center">10%</td>
                                        <td className="border border-slate-300 p-2 text-right font-mono font-bold">{formatMAD(tax.tva10)}</td>
                                    </tr>
                                    <tr className="bg-slate-100 font-bold">
                                        <td className="border border-slate-300 p-2 text-right" colSpan={3}>TOTAL TVA COLLECTÉE</td>
                                        <td className="border border-slate-300 p-2 text-right">{formatMAD(tax.totalTva)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* SECTION 2: DÉDUCTIONS */}
                        <div className="mb-8">
                            <h2 className="text-sm font-black uppercase bg-slate-100 p-2 border-y border-black mb-4">II. Déductions & Régularisations</h2>
                            <table className="w-full text-sm border-collapse border border-slate-300">
                                <tbody>
                                    <tr>
                                        <td className="border border-slate-300 p-2">TVA sur Achats (Récupérable)</td>
                                        <td className="border border-slate-300 p-2 text-right w-32">-</td>
                                    </tr>
                                    <tr className="bg-red-50 text-red-700 font-medium">
                                        <td className="border border-slate-300 p-2">RÉGULARISATIONS (AVOIRS CLIENTS)</td>
                                        <td className="border border-slate-300 p-2 text-right">{formatMAD(refundedVAT)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* SECTION 3: NET A PAYER */}
                        <div className="mt-8 border-2 border-black p-6 bg-slate-50">
                            <div className="flex justify-between items-center text-xl font-black uppercase">
                                <span>TVA Nette à Verser</span>
                                <span>{formatMAD(netToPay)}</span>
                            </div>
                        </div>

                        {/* SIGNATURES */}
                        <div className="mt-16 flex justify-between text-xs">
                            <div className="text-center w-1/3">
                                <p className="font-bold underline mb-12">Le Comptable</p>
                            </div>
                            <div className="text-center w-1/3">
                                <p className="font-bold underline mb-12">La Direction</p>
                            </div>
                        </div>

                        <div className="absolute bottom-[10mm] left-0 right-0 text-center text-[8px] text-slate-400">
                            Document généré par ISSLI PECHE ERP - Usage interne uniquement.
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};