import React, { useState } from 'react';
import { 
    X, FileSpreadsheet, Printer, Calendar, Download, 
    FileText, Wallet, PackageSearch, Loader2, Landmark
} from 'lucide-react';
import client from '../api/client';
import { VATReportPrint } from './VATReportPrint';

interface Props {
    onClose: () => void;
    data: any; 
}

export const FinancialReportModal: React.FC<Props> = ({ onClose, data: initialData }) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(new Date().getMonth()); 
    const [mode, setMode] = useState<'EXPORT' | 'PRINT_VAT'>('EXPORT');
    const [downloading, setDownloading] = useState<string | null>(null);

    const getDates = () => {
        if (selectedMonth === 'ALL') {
            return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
        }
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0); 
        const format = (d: Date) => d.toISOString().split('T')[0];
        return { start: format(start), end: format(end) };
    };

    const downloadReport = async (endpoint: string, filenamePrefix: string) => {
        try {
            setDownloading(endpoint);
            const { start, end } = getDates();
            const response = await client.get(`/legal/reports/${endpoint}`, {
                params: { start, end },
                responseType: 'blob' 
            });

            // 🛠️ THE FIX: Explicitly set the MIME type to UTF-8 CSV so Windows/Excel respects the encoding
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${filenamePrefix}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error("Download Error:", error);
            alert("Erreur lors du téléchargement.");
        } finally {
            setDownloading(null);
        }
    };

    if (mode === 'PRINT_VAT') {
        const { start, end } = getDates();
        return (
            <VATReportPrint 
                data={initialData} 
                period={{ from: start, to: end }}
                onClose={() => setMode('EXPORT')}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">
                
                {/* HEADER */}
                <div className="bg-slate-900 p-6 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <FileText className="text-amber-500" /> Espace Comptable
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Données conformes DGI (UTF-8 + Format Français)</p>
                    </div>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {/* PERIOD */}
                    <div className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Calendar size={16}/> Période de Déclaration
                        </h3>
                        <div className="flex gap-4">
                            <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 block w-full p-2.5 font-bold"
                            >
                                <option value={2026}>Exercice 2026</option>
                                <option value={2025}>Exercice 2025</option>
                            </select>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                                className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 block w-full p-2.5 font-bold"
                            >
                                <option value="ALL">Année Complète</option>
                                {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((m, i) => (
                                    <option key={i} value={i}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* JOURNAL VENTES (IS) */}
                        <div className={`border border-slate-200 rounded-xl p-5 group cursor-pointer relative bg-white ${downloading === 'journal' ? 'opacity-50' : 'hover:border-emerald-500'}`}
                             onClick={() => downloadReport('journal', 'Journal_Ventes_IS')}>
                            <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 p-2 rounded-lg group-hover:bg-emerald-600 group-hover:text-white">
                                {downloading === 'journal' ? <Loader2 className="animate-spin"/> : <FileSpreadsheet size={24} />}
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg mb-1">Journal des Ventes</h4>
                            <p className="text-xs text-slate-500 mb-3">Pour l'IS (Facturé/Débit)</p>
                            <button className="w-full py-2 bg-emerald-50 text-emerald-700 font-bold rounded text-xs">Export CSV</button>
                        </div>

                        {/* RELEVE TVA (ENCAISSEMENT) */}
                        <div className={`border border-slate-200 rounded-xl p-5 group cursor-pointer relative bg-white ${downloading === 'receipts' ? 'opacity-50' : 'hover:border-violet-500'}`}
                             onClick={() => downloadReport('receipts', 'Releve_TVA_Encaissement')}>
                            <div className="absolute top-4 right-4 bg-violet-100 text-violet-700 p-2 rounded-lg group-hover:bg-violet-600 group-hover:text-white">
                                {downloading === 'receipts' ? <Loader2 className="animate-spin"/> : <Wallet size={24} />}
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg mb-1">Relevé de TVA</h4>
                            <p className="text-xs text-slate-500 mb-3">Détail Payé (Base + TVA 10/20)</p>
                            <button className="w-full py-2 bg-violet-50 text-violet-700 font-bold rounded text-xs">Export CSV</button>
                        </div>

                        {/* BILAN / ACTIF */}
                        <div className={`border border-slate-200 rounded-xl p-5 group cursor-pointer relative bg-white ${downloading === 'bilan' ? 'opacity-50' : 'hover:border-indigo-500'}`}
                             onClick={() => downloadReport('bilan', 'Bilan_Actif')}>
                            <div className="absolute top-4 right-4 bg-indigo-100 text-indigo-700 p-2 rounded-lg group-hover:bg-indigo-600 group-hover:text-white">
                                {downloading === 'bilan' ? <Loader2 className="animate-spin"/> : <Landmark size={24} />}
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg mb-1">Situation (Bilan)</h4>
                            <p className="text-xs text-slate-500 mb-3">Valeur Stock & Créances</p>
                            <button className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold rounded text-xs">Export CSV</button>
                        </div>

                        {/* STOCK */}
                        <div className={`border border-slate-200 rounded-xl p-5 group cursor-pointer relative bg-white ${downloading === 'inventory' ? 'opacity-50' : 'hover:border-orange-500'}`}
                             onClick={() => downloadReport('inventory', 'Inventaire_Stock')}>
                            <div className="absolute top-4 right-4 bg-orange-100 text-orange-700 p-2 rounded-lg group-hover:bg-orange-600 group-hover:text-white">
                                {downloading === 'inventory' ? <Loader2 className="animate-spin"/> : <PackageSearch size={24} />}
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg mb-1">Inventaire Détail</h4>
                            <p className="text-xs text-slate-500 mb-3">Quantités & PAMP</p>
                            <button className="w-full py-2 bg-orange-50 text-orange-700 font-bold rounded text-xs">Export CSV</button>
                        </div>

                    </div>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-xs text-slate-400 shrink-0">
                    ISSLI PECHE ERP v3.6.0 • Module Certifié
                </div>
            </div>
        </div>
    );
};