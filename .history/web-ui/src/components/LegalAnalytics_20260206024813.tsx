import React, { useEffect, useState } from 'react';
import { 
    TrendingUp, ArrowLeft, RefreshCw, Layers, 
    Landmark, Coins, Package, Activity, AlertTriangle, 
    Calendar, FileSpreadsheet, LineChart, Wallet, BarChart3, CheckCircle2
} from 'lucide-react';
import client from '../api/client';
import { FinancialReportModal } from './FinancialReportModal';

interface AnalyticsProps {
    onBack: () => void;
}

export const LegalAnalytics: React.FC<AnalyticsProps> = ({ onBack }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await client.get(`/legal/reports/analytics?year=${year}`);
            setData(res.data);
        } catch (error) { console.error(error); } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAnalytics(); }, [year]);

    // 🛡️ SAFE BIG DATA FORMATTER
    const formatCompact = (n: any) => {
        const num = Number(n);
        if (isNaN(num)) return "0";
        return new Intl.NumberFormat('fr-MA', { 
            notation: "compact", 
            compactDisplay: "short", 
            maximumFractionDigits: 1 
        }).format(num);
    };

    const shortMonths = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div></div>;
    if (!data) return <div className="p-20 text-center text-red-400">Données indisponibles.</div>;

    const { kpi } = data;
    const safeTax = kpi.taxAnalysis || { tva10: 0, tva20: 0, totalTva: 0 };
    
    // Scale Logic
    const maxVal = Math.max(...data.charts.monthly.map((m: any) => Math.max(m.revenue, m.refunds)), 1000);

    return (
        <div className="bg-slate-50 min-h-screen p-8 font-sans text-slate-800">
            <style>{`
                @media print { @page { size: landscape; margin: 10mm; } body { background: white; } .no-print { display: none !important; } .print-shadow-none { box-shadow: none !important; border: 1px solid #ddd; } }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
            `}</style>

            {/* HEADER */}
            <div className="no-print mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <button onClick={onBack} className="text-slate-400 hover:text-blue-900 flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider transition-colors"><ArrowLeft size={14}/> Retour Dashboard</button>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <Activity className="text-blue-900" size={32} /> ANALYTIQUE <span className="text-slate-300 font-light">|</span> <span className="text-blue-900">STOCK A</span>
                    </h1>
                </div>
                
                <div className="flex gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <select value={year} onChange={e => setYear(Number(e.target.value))} className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition-colors appearance-none">
                            {[2026, 2025, 2024].map(y => <option key={y} value={y}>Exercice {y}</option>)}
                        </select>
                    </div>
                    <div className="w-px bg-slate-200 my-1"></div>
                    <button onClick={() => setShowReportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-md active:scale-95"><FileSpreadsheet size={16} /> Rapports</button>
                    <button onClick={fetchAnalytics} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><RefreshCw size={20} /></button>
                </div>
            </div>

            {/* 1. FINANCIAL KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                
                {/* Revenue */}
                <div className="bg-white p-6 rounded-2xl border-l-4 border-l-blue-900 shadow-sm print-shadow-none">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chiffre d'Affaires (HT)</p>
                            <h2 className="text-3xl font-black text-slate-900 mt-1 truncate tracking-tight">{formatCompact(kpi.netRevenue)} <span className="text-sm text-slate-400 font-medium">MAD</span></h2>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-900 rounded-lg"><TrendingUp size={20}/></div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-medium border-t border-slate-100 pt-3">
                        <span className="text-slate-500">Brut: {formatCompact(kpi.grossRevenue)}</span>
                        {kpi.totalRefunds > 0 && <span className="text-rose-600 ml-auto font-bold">-{formatCompact(kpi.totalRefunds)} (Avr)</span>}
                    </div>
                </div>

                {/* DEBT CARD */}
                <div className="bg-white p-6 rounded-2xl border-l-4 border-l-red-500 shadow-sm print-shadow-none">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Créances Clients</p>
                            <h2 className="text-3xl font-black text-red-600 mt-1 truncate tracking-tight">{formatCompact(kpi.totalDebt)} <span className="text-sm text-red-300 font-medium">MAD</span></h2>
                        </div>
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={20}/></div>
                    </div>
                    <p className="text-[10px] text-right mt-1 text-red-600 font-bold border-t border-slate-100 pt-3">En attente de paiement</p>
                </div>

                {/* Tax */}
                <div className="bg-white p-6 rounded-2xl border-l-4 border-l-amber-500 shadow-sm print-shadow-none">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TVA à Reverser</p>
                            <h2 className="text-3xl font-black text-slate-900 mt-1 truncate tracking-tight">{formatCompact(safeTax.totalTva)} <span className="text-sm text-slate-400 font-medium">MAD</span></h2>
                        </div>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Landmark size={20}/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-100 pt-3">
                        <div><span className="text-slate-400">20%:</span> <span className="font-bold text-slate-700">{formatCompact(safeTax.tva20)}</span></div>
                        <div className="text-right"><span className="text-slate-400">10%:</span> <span className="font-bold text-slate-700">{formatCompact(safeTax.tva10)}</span></div>
                    </div>
                </div>

                {/* Margin */}
                <div className="bg-white p-6 rounded-2xl border-l-4 border-l-emerald-500 shadow-sm print-shadow-none">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marge Nette</p>
                            <h2 className="text-3xl font-black text-emerald-700 mt-1 truncate tracking-tight">{formatCompact(kpi.grossMargin)} <span className="text-sm text-emerald-400 font-medium">MAD</span></h2>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Coins size={20}/></div>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                        <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(kpi.marginRate, 100)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-right mt-1 text-emerald-600 font-bold">{kpi.marginRate?.toFixed(1)}% Rentabilité</p>
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* Monthly Chart */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[350px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2"><BarChart3 size={20} className="text-blue-900"/> Flux Financiers</h3>
                            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-900"></span> Ventes</div>
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-rose-500"></span> Avoirs</div>
                            </div>
                        </div>
                        <div className="flex-1 flex items-end gap-2 border-b border-slate-100 pb-2">
                             {data.charts.monthly.map((m: any, i: number) => {
                                const hRev = maxVal > 0 ? (m.revenue / maxVal) * 100 : 0;
                                const hRef = maxVal > 0 ? (m.refunds / maxVal) * 100 : 0;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                            <div className="w-full max-w-[40px] flex flex-col-reverse bg-slate-50 rounded-t-sm relative h-full justify-end overflow-hidden">
                                                <div className="w-full bg-rose-500 absolute bottom-0 z-10" style={{ height: `${hRef}%` }}></div>
                                                <div className="w-full bg-blue-900 hover:bg-blue-800 transition-all" style={{ height: `${hRev}%` }}></div>
                                            </div>
                                            <span className="mt-3 text-[10px] font-bold text-slate-400 uppercase">{shortMonths[i]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Lists */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[250px]">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><Package size={16} className="text-indigo-600"/> Top Produits (Vol.)</h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                            {data.charts.topProducts.map((p: any, i: number) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between text-[11px] font-bold mb-1 text-slate-600">
                                        <span className="truncate w-[60%]">{p.name}</span>
                                        <span className="font-mono text-slate-900">{p.total} u</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full"><div className="bg-indigo-600 h-full" style={{ width: `${(p.total / (data.charts.topProducts[0]?.total || 1)) * 100}%` }}></div></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showReportModal && <FinancialReportModal data={data} onClose={() => setShowReportModal(false)} />}
        </div>
    );
};