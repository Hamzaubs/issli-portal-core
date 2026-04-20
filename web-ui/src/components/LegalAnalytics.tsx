// web-ui/src/components/LegalAnalytics.tsx
import React, { useEffect, useState } from 'react';
import { 
    TrendingUp, ArrowLeft, RefreshCw, 
    Landmark, Coins, Package, Activity, AlertTriangle, 
    Calendar, FileSpreadsheet, BarChart3, Users, ArrowDownRight, AlertCircle, Receipt, ShieldCheck
} from 'lucide-react';
import client from '../api/client';
import { FinancialReportModal } from './FinancialReportModal';

interface AnalyticsProps {
    onBack?: () => void;
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
    if (!data || !data.kpi) return <div className="p-20 text-center text-red-400">Données indisponibles.</div>;

    const { kpi, charts, alerts } = data;
    const maxVal = Math.max(...(charts.monthly || []).map((m: any) => Math.max(Number(m.revenue || 0), Number(m.collected || 0))), 1000);

    return (
        <div className="bg-slate-50 min-h-screen p-8 font-sans text-slate-800 absolute inset-0 z-50 overflow-y-auto">
            <style>{`
                @media print { 
                    @page { size: landscape; margin: 10mm; } 
                    body { background: white; } 
                    .no-print { display: none !important; } 
                    .print-shadow-none { box-shadow: none !important; border: 1px solid #e2e8f0; } 
                    .print-break-inside-avoid { break-inside: avoid; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
            `}</style>

            {/* HEADER */}
            <div className="no-print mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    {/* ✅ DRILL-DOWN BACK BUTTON */}
                    {onBack && (
                        <button onClick={onBack} className="text-slate-400 hover:text-blue-900 flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider transition-colors">
                            <ArrowLeft size={14}/> Retour Globale
                        </button>
                    )}
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <Activity className="text-blue-900" size={32} /> ANALYTIQUE <span className="text-slate-300 font-light">|</span> <span className="text-blue-900">BUREAU LÉGAL</span>
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
                    <button onClick={() => setShowReportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all shadow-md active:scale-95">
                        <FileSpreadsheet size={16} /> Rapports Excel
                    </button>
                    <button onClick={fetchAnalytics} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><RefreshCw size={20} /></button>
                </div>
            </div>

            {/* SECTION 1: PERFORMANCE & RENTABILITÉ */}
            <div className="mb-6">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp size={16} /> Performance Commerciale ({year})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* CA Facturé */}
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-blue-900 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CA Facturé (HT)</p>
                                <h2 className="text-3xl font-black text-slate-900 mt-1 truncate tracking-tight">{formatCompact(kpi.yearlyHT || kpi.netRevenue)} <span className="text-sm text-slate-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-blue-50 text-blue-900 rounded-lg"><TrendingUp size={20}/></div>
                        </div>
                        <div className="text-[10px] border-t border-slate-100 pt-3 text-slate-500 font-bold flex justify-between">
                            <span>Équivalent TTC:</span>
                            <span className="text-slate-800">{formatCompact(kpi.yearlyTTC || 0)} MAD</span>
                        </div>
                    </div>

                    {/* Marge Brute */}
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-emerald-500 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marge Brute</p>
                                <h2 className="text-3xl font-black text-emerald-700 mt-1 truncate tracking-tight">{formatCompact(kpi.yearlyMargin || kpi.grossMargin)} <span className="text-sm text-emerald-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Coins size={20}/></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] border-t border-slate-100 pt-3 font-bold">
                            <span className="text-slate-500">Taux de Marge:</span>
                            <span className="text-emerald-600">{Number(kpi.marginRate).toFixed(1)}%</span>
                        </div>
                    </div>

                    {/* Retours & Avoirs */}
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-rose-500 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retours (Avoirs HT)</p>
                                <h2 className="text-3xl font-black text-rose-700 mt-1 truncate tracking-tight">{formatCompact(kpi.totalRefunds)} <span className="text-sm text-rose-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ArrowDownRight size={20}/></div>
                        </div>
                        <div className="text-[10px] border-t border-slate-100 pt-3 text-slate-500">
                            Avoirs déduits du CA global
                        </div>
                    </div>

                    {/* Devis / Pipeline */}
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-amber-500 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline Devis (TTC)</p>
                                <h2 className="text-3xl font-black text-amber-700 mt-1 truncate tracking-tight">{formatCompact(kpi.quotesVolume)} <span className="text-sm text-amber-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Receipt size={20}/></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] border-t border-slate-100 pt-3 font-bold">
                            <span className="text-slate-500">Devis Actifs:</span>
                            <span className="text-amber-600">{kpi.quotesCount || 0} Documents</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 2: TRÉSORERIE, FISCALITÉ & ACTIFS */}
            <div className="mb-8">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Landmark size={16} /> Trésorerie, Créances & Actifs
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Encaissements */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Encaissé</p>
                            <div className="p-1.5 bg-slate-50 text-slate-600 rounded"><Activity size={16}/></div>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mt-1">{formatCompact(kpi.collectedCash)} <span className="text-xs text-slate-400 font-medium">MAD</span></h2>
                        <div className="flex justify-between text-[10px] mt-2 text-slate-500 border-t border-slate-100 pt-2 font-bold">
                            <span>Aujourd'hui:</span>
                            <span className="text-emerald-600">+{formatCompact(kpi.revenueToday)} MAD</span>
                        </div>
                    </div>

                    {/* Créances Clients */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Créances (Créance TTC)</p>
                            <div className={`p-1.5 rounded ${kpi.totalDebt > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {kpi.totalDebt > 0 ? <AlertTriangle size={16}/> : <ShieldCheck size={16}/>}
                            </div>
                        </div>
                        <h2 className={`text-2xl font-black mt-1 ${kpi.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatCompact(kpi.totalDebt)} <span className="text-xs text-slate-400 font-medium">MAD</span>
                        </h2>
                        <p className="text-[10px] mt-2 text-slate-500 border-t border-slate-100 pt-2">Total des factures impayées</p>
                    </div>

                    {/* TVA */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TVA Facturée</p>
                            <div className="p-1.5 bg-purple-50 text-purple-600 rounded"><Landmark size={16}/></div>
                        </div>
                        <h2 className="text-2xl font-black text-purple-700 mt-1">{formatCompact(kpi.invoicedVAT)} <span className="text-xs text-purple-400 font-medium">MAD</span></h2>
                        <p className="text-[10px] mt-2 text-slate-500 border-t border-slate-100 pt-2">TVA collectée sur CA global</p>
                    </div>

                    {/* Valeur Stock HT */}
                    <div className="bg-white p-6 rounded-2xl border-b-4 border-b-indigo-600 shadow-sm print-shadow-none print-break-inside-avoid bg-indigo-50/30">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Valeur Stock HT</p>
                            <div className="p-1.5 bg-indigo-600 text-white rounded"><Package size={16}/></div>
                        </div>
                        <h2 className="text-2xl font-black text-indigo-700 mt-1">{formatCompact(kpi.stockValue)} <span className="text-xs text-indigo-400 font-medium">MAD</span></h2>
                        <p className="text-[10px] mt-2 text-indigo-800/60 font-medium border-t border-indigo-200/50 pt-2">Actif Immobilisé (Coût PAMP)</p>
                    </div>
                </div>
            </div>

            {/* SECTION 3: CHARTS & LISTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
                {/* Main Left Column (Charts & Alerts) */}
                <div className="lg:col-span-2 flex flex-col gap-8 print:mb-8">
                    {/* Monthly Chart */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px] flex flex-col print-break-inside-avoid">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2"><BarChart3 size={20} className="text-blue-900"/> Facturation vs Encaissement</h3>
                            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-900"></span> Facturé</div>
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500"></span> Encaissé</div>
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-rose-500"></span> Avoirs</div>
                            </div>
                        </div>
                        <div className="flex-1 flex items-end gap-2 border-b border-slate-100 pb-2">
                             {charts.monthly.map((m: any, i: number) => {
                                const revenue = Number(m.revenue || 0);
                                const collected = Number(m.collected || 0);
                                const refunds = Number(m.refunds || 0);
                                
                                const hRev = maxVal > 0 ? (revenue / maxVal) * 100 : 0;
                                const hCol = maxVal > 0 ? (collected / maxVal) * 100 : 0;
                                const hRef = maxVal > 0 ? (refunds / maxVal) * 100 : 0;
                                
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative gap-1">
                                            <div className="w-full max-w-[40px] flex items-end justify-center bg-slate-50 rounded-t-sm relative h-full overflow-hidden gap-0.5">
                                                <div className="w-1/3 bg-rose-500 transition-all rounded-t-sm" style={{ height: `${hRef}%` }} title={`Avoirs: ${formatCompact(refunds)}`}></div>
                                                <div className="w-1/3 bg-emerald-500 transition-all rounded-t-sm" style={{ height: `${hCol}%` }} title={`Encaissé: ${formatCompact(collected)}`}></div>
                                                <div className="w-1/3 bg-blue-900 transition-all rounded-t-sm" style={{ height: `${hRev}%` }} title={`Facturé: ${formatCompact(revenue)}`}></div>
                                            </div>
                                            <span className="mt-2 text-[10px] font-bold text-slate-400 uppercase">{shortMonths[i]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Low Stock Alerts (If any) */}
                    {alerts && alerts.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl shadow-sm print-break-inside-avoid">
                            <h3 className="font-bold text-rose-800 mb-4 flex items-center gap-2 text-sm">
                                <AlertCircle size={18} /> Alertes Stock (Seuil Critique ≤ 5)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {alerts.map((alert: any, i: number) => (
                                    <div key={i} className="bg-white border border-rose-100 p-3 rounded-xl flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-700 truncate pr-4">{alert.name}</span>
                                        <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-black rounded-md whitespace-nowrap">
                                            {alert.quantity} Restant
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column (High Density Lists) */}
                <div className="flex flex-col gap-6 print:block">
                    {/* Top Products */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[250px] print-break-inside-avoid print:mb-8">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><Package size={16} className="text-indigo-600"/> Top Produits (Volume)</h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
                            {charts.topProducts.map((p: any, i: number) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-700">
                                        <span className="truncate w-[65%]">{p.name}</span>
                                        <span className="font-mono text-slate-900 bg-slate-100 px-1.5 rounded">{Number(p.total).toFixed(1)} u</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full"><div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(p.total / (charts.topProducts[0]?.total || 1)) * 100}%` }}></div></div>
                                </div>
                            ))}
                            {charts.topProducts.length === 0 && <p className="text-xs text-slate-400 italic text-center mt-10">Aucune donnée</p>}
                        </div>
                    </div>

                    {/* Top Clients */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[250px] print-break-inside-avoid">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><Users size={16} className="text-blue-600"/> Top Clients (CA Actif)</h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
                            {charts.topClients.map((c: any, i: number) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-700">
                                        <span className="truncate w-[65%]">{c.name}</span>
                                        <span className="font-mono text-blue-900 bg-blue-50 px-1.5 rounded">{formatCompact(c.total)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full"><div className="bg-blue-600 h-full rounded-full" style={{ width: `${(c.total / (charts.topClients[0]?.total || 1)) * 100}%` }}></div></div>
                                </div>
                            ))}
                            {charts.topClients.length === 0 && <p className="text-xs text-slate-400 italic text-center mt-10">Aucune donnée</p>}
                        </div>
                    </div>
                </div>
            </div>

            {showReportModal && <FinancialReportModal data={data} onClose={() => setShowReportModal(false)} />}
        </div>
    );
};