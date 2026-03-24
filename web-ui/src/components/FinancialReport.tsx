import React, { useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { 
    FileText, X, Printer, Calendar, TrendingUp, ShieldCheck, Zap, 
    FileBarChart, FileSpreadsheet, Database, Percent, Banknote, AlertTriangle
} from 'lucide-react';
import client from '../api/client';

interface ReportProps {
    onClose: () => void;
    data: {
        stats: any; // Contains the full KPI object from LegalReportController
        period: { from: string; to: string };
    };
}

export const FinancialReport: React.FC<ReportProps> = ({ onClose, data }) => {
    const componentRef = useRef(null);
    const handlePrint = useReactToPrint({ contentRef: componentRef, documentTitle: "Rapport_Financier_ISSLI_PECHE" });
    
    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-MA') : '-';

    const kpi = data.stats.kpi || {};
    
    // Internal Silo B Metrics (passed separately if from global dash, or 0 if from legal only)
    const stockValInternal = Number(data.stats.stockValueInternal || 0);
    const revenueInternal = Number(data.stats.revenueInternal || 0);
    const isGlobal = revenueInternal > 0 || stockValInternal > 0;

    // Export Logic
    const downloadManagerCSV = () => {
        let csv = 'sep=;\n';
        csv += `RAPPORT DE GESTION;ISSLI PECHE\n`;
        csv += `PERIODE;${formatDate(data.period.from)} au ${formatDate(data.period.to)}\n\n`;
        csv += `METRIQUE;VALEUR (MAD)\n`;
        csv += `CA Net (Legal);${kpi.netRevenue?.toFixed(2)}\n`;
        csv += `Marge Brute (Legal);${kpi.grossMargin?.toFixed(2)}\n`;
        csv += `Valeur Stock (Legal);${kpi.stockValue?.toFixed(2)}\n`;
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Rapport_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]">
                
                {/* HEADER */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="font-bold flex items-center gap-2 text-slate-800"><FileText /> Rapport Financier</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded text-slate-500"><X size={20} /></button>
                </div>

                {/* TOOLBAR */}
                <div className="p-4 border-b border-gray-100 bg-white flex flex-wrap gap-3 items-center justify-between shadow-sm z-10">
                    <div className="flex gap-2">
                        <button onClick={downloadManagerCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 text-sm">
                            <FileBarChart size={16} /> Export Excel
                        </button>
                        <button onClick={() => handlePrint()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white font-bold rounded-lg text-sm">
                            <Printer size={16} /> Imprimer
                        </button>
                    </div>
                </div>

                {/* REPORT PAGE */}
                <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
                    <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[20mm] text-slate-900 shadow-sm relative font-serif flex flex-col">
                        
                        <div className="text-center border-b-2 border-black pb-4 mb-8">
                            <h1 className="text-3xl font-black uppercase tracking-widest">Rapport Financier</h1>
                            <p className="text-sm mt-2 font-bold uppercase">ISSLI PECHE S.A.R.L</p>
                            <div className="flex justify-center items-center gap-2 mt-2 text-xs font-mono bg-gray-100 py-1 inline-block px-4 rounded">
                                <Calendar size={12}/> Période : {formatDate(data.period.from)} ➜ {formatDate(data.period.to)}
                            </div>
                        </div>

                        {/* 1. KEY FIGURES */}
                        <div className="mb-8">
                            <h2 className="text-lg font-bold uppercase border-b border-gray-300 pb-1 mb-4 text-blue-900 flex items-center gap-2"><TrendingUp size={18} /> 1. Indicateurs Clés (Silo A)</h2>
                            <table className="w-full text-sm border-collapse border border-gray-300">
                                <tbody className="divide-y divide-gray-300">
                                    <tr>
                                        <td className="p-3 bg-gray-50 font-bold">Chiffre d'Affaires Net (HT)</td>
                                        <td className="p-3 text-right font-mono font-black text-lg">{formatMAD(kpi.netRevenue)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 bg-gray-50 font-bold">Marge Brute Estimée (20%)</td>
                                        <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatMAD(kpi.grossMargin)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 bg-gray-50 font-bold">TVA Nette (À Reverser)</td>
                                        <td className="p-3 text-right font-mono font-bold text-purple-700">{formatMAD(kpi.netVAT)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 2. ASSETS */}
                        <div className="mb-8">
                            <h2 className="text-lg font-bold uppercase border-b border-gray-300 pb-1 mb-4 text-indigo-900 flex items-center gap-2"><Database size={18} /> 2. Valorisation Actifs</h2>
                            <table className="w-full text-sm border-collapse border border-gray-300">
                                <thead className="bg-gray-100">
                                    <tr><th className="border p-2 text-left">Poste</th><th className="border p-2 text-right">Valeur (HT)</th></tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border p-2 font-bold text-indigo-700">Stock Légal (Silo A)</td>
                                        <td className="border p-2 text-right font-mono">{formatMAD(kpi.stockValue)}</td>
                                    </tr>
                                    {isGlobal && (
                                        <tr>
                                            <td className="border p-2 font-bold text-orange-700">Stock Interne (Silo B)</td>
                                            <td className="border p-2 text-right font-mono">{formatMAD(stockValInternal)}</td>
                                        </tr>
                                    )}
                                    <tr className="bg-gray-50 border-t-2 border-black">
                                        <td className="border p-2 font-black uppercase">Total Immobilisé</td>
                                        <td className="border p-2 text-right font-black">
                                            {formatMAD((kpi.stockValue || 0) + stockValInternal)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 3. TAX DETAIL */}
                        <div className="mb-8">
                            <h2 className="text-lg font-bold uppercase border-b border-gray-300 pb-1 mb-4 text-purple-900 flex items-center gap-2"><Percent size={18} /> 3. Détail Fiscal</h2>
                            <div className="bg-purple-50 p-4 border border-purple-100 rounded text-sm">
                                <div className="flex justify-between mb-2">
                                    <span>TVA Collectée (Ventes):</span>
                                    <span className="font-bold">{formatMAD(kpi.collectedVAT)}</span>
                                </div>
                                <div className="flex justify-between mb-2 text-red-600">
                                    <span>TVA Récupérable (Retours):</span>
                                    <span className="font-bold">-{formatMAD(kpi.refundedVAT)}</span>
                                </div>
                                <div className="border-t border-purple-200 pt-2 flex justify-between font-black text-lg">
                                    <span>NET À PAYER:</span>
                                    <span>{formatMAD(kpi.netVAT)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-8 text-center text-[10px] text-gray-400 border-t border-gray-200 uppercase tracking-widest">
                            Document Confidentiel • Ne pas distribuer • Généré le {new Date().toLocaleDateString('fr-MA')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};