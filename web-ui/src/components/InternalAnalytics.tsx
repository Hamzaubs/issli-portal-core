// web-ui/src/components/InternalAnalytics.tsx
import React, { useEffect, useState } from 'react';
import { 
    TrendingUp, ArrowLeft, RefreshCw, 
    Landmark, Coins, Package, Activity, AlertTriangle, 
    Calendar, BarChart3, Users, ArrowDownRight, AlertCircle, ShoppingCart, FileText
} from 'lucide-react';
import client from '../api/client';

interface AnalyticsProps {
    onBack?: () => void;
}

export const InternalAnalytics: React.FC<AnalyticsProps> = ({ onBack }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await client.get(`/internal/analytics?year=${year}`);
            setData(res.data);
        } catch (error) { console.error(error); } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAnalytics(); }, [year]);

    const formatCompact = (n: any) => {
        const num = Number(n);
        if (isNaN(num) || num === 0) return "0";
        return new Intl.NumberFormat('fr-MA', { 
            notation: "compact", 
            compactDisplay: "short", 
            maximumFractionDigits: 1 
        }).format(num);
    };

    const shortMonths = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div></div>;
    if (!data || !data.kpi) return <div className="p-20 text-center text-red-400">Données indisponibles.</div>;

    const { kpi, charts, alerts } = data;
    const maxVal = Math.max(...(charts.monthly || []).map((m: any) => Math.max(Number(m.revenue || 0), Number(m.collected || 0), Number(m.quotes || 0))), 1000);

    return (
        <div className="bg-slate-50 min-h-full p-8 font-sans text-slate-800 absolute inset-0 z-50 overflow-y-auto">
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

            <div className="no-print mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    {/* ✅ DRILL-DOWN BACK BUTTON */}
                    {onBack && (
                        <button onClick={onBack} className="text-slate-400 hover:text-emerald-700 flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider transition-colors">
                            <ArrowLeft size={14}/> Retour Globale
                        </button>
                    )}
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <Activity className="text-emerald-700" size={32} /> ANALYTIQUE <span className="text-slate-300 font-light">|</span> <span className="text-emerald-700">STOCK B</span>
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
                    <button onClick={fetchAnalytics} className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><RefreshCw size={20} /></button>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp size={16} /> Performance & Ventes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-emerald-600 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CA Magasin Global</p>
                                <h2 className="text-3xl font-black text-slate-900 mt-1 truncate tracking-tight">{formatCompact(kpi.netRevenue)} <span className="text-sm text-slate-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ShoppingCart size={20}/></div>
                        </div>
                        <div className="text-[10px] border-t border-slate-100 pt-3 text-slate-500">Total ventes (Cash + Crédit)</div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-blue-500 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marge Brute B</p>
                                <h2 className="text-3xl font-black text-blue-700 mt-1 truncate tracking-tight">{formatCompact(kpi.grossMargin)} <span className="text-sm text-blue-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Coins size={20}/></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] border-t border-slate-100 pt-3 font-bold">
                            <span className="text-slate-500">Taux de Marge:</span>
                            <span className="text-blue-600">{Number(kpi.marginRate).toFixed(1)}%</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-rose-500 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valeur Retours</p>
                                <h2 className="text-3xl font-black text-rose-700 mt-1 truncate tracking-tight">{formatCompact(kpi.totalRefunds)} <span className="text-sm text-rose-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ArrowDownRight size={20}/></div>
                        </div>
                        <div className="text-[10px] border-t border-slate-100 pt-3 text-slate-500">Volume des retours acceptés</div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border-l-4 border-l-amber-400 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Devis en Attente</p>
                                <h2 className="text-3xl font-black text-amber-600 mt-1 truncate tracking-tight">{formatCompact(kpi.totalQuotes || 0)} <span className="text-sm text-amber-400 font-medium">MAD</span></h2>
                            </div>
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><FileText size={20}/></div>
                        </div>
                        <div className="text-[10px] border-t border-slate-100 pt-3 text-slate-500">Volume de vente potentiel</div>
                    </div>
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Landmark size={16} /> Trésorerie & Actifs Internes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trésorerie Réelle</p>
                            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded"><Activity size={16}/></div>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mt-1">{formatCompact(kpi.collectedCash)} <span className="text-xs text-slate-400 font-medium">MAD</span></h2>
                        <p className="text-[10px] mt-2 text-slate-500">Total Encaissé (Espèces / Virement)</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print-shadow-none print-break-inside-avoid">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dette Clients Actives</p>
                            <div className="p-1.5 bg-orange-50 text-orange-600 rounded"><AlertTriangle size={16}/></div>
                        </div>
                        <h2 className="text-2xl font-black text-orange-600 mt-1">{formatCompact(kpi.periodBalance)} <span className="text-xs text-slate-400 font-medium">MAD</span></h2>
                        <p className="text-[10px] mt-2 text-slate-500">Créances B à recouvrir</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border-b-4 border-b-purple-600 shadow-sm print-shadow-none print-break-inside-avoid bg-purple-50/30">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-purple-900 uppercase tracking-widest">Valeur Stock Magasin</p>
                            <div className="p-1.5 bg-purple-600 text-white rounded"><Package size={16}/></div>
                        </div>
                        <h2 className="text-2xl font-black text-purple-700 mt-1">{formatCompact(kpi.stockValue)} <span className="text-xs text-purple-400 font-medium">MAD</span></h2>
                        <p className="text-[10px] mt-2 text-purple-800/60 font-medium">Actif Magasin (Coût PAMP)</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
                <div className="lg:col-span-2 flex flex-col gap-8 print:mb-8">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px] flex flex-col print-break-inside-avoid">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2"><BarChart3 size={20} className="text-emerald-700"/> Activité Mensuelle (Silo B)</h3>
                            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-600"></span> Ventes</div>
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-400"></span> Devis</div>
                                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-500"></span> Encaissé</div>
                            </div>
                        </div>
                        <div className="flex-1 flex items-end gap-2 border-b border-slate-100 pb-2">
                             {charts.monthly.map((m: any, i: number) => {
                                const revenue = Number(m.revenue || 0);
                                const collected = Number(m.collected || 0);
                                const quotes = Number(m.quotes || 0);
                                
                                const hRev = maxVal > 0 ? (revenue / maxVal) * 100 : 0;
                                const hCol = maxVal > 0 ? (collected / maxVal) * 100 : 0;
                                const hQuo = maxVal > 0 ? (quotes / maxVal) * 100 : 0;
                                
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative gap-1">
                                            <div className="w-full max-w-[40px] flex items-end justify-center bg-slate-50 rounded-t-sm relative h-full overflow-hidden gap-0.5">
                                                <div className="w-1/3 bg-amber-400 transition-all rounded-t-sm" style={{ height: `${hQuo}%` }} title={`Devis: ${formatCompact(quotes)}`}></div>
                                                <div className="w-1/3 bg-blue-500 transition-all rounded-t-sm" style={{ height: `${hCol}%` }} title={`Encaissé: ${formatCompact(collected)}`}></div>
                                                <div className="w-1/3 bg-emerald-600 transition-all rounded-t-sm" style={{ height: `${hRev}%` }} title={`Ventes: ${formatCompact(revenue)}`}></div>
                                            </div>
                                            <span className="mt-2 text-[10px] font-bold text-slate-400 uppercase">{shortMonths[i]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {alerts && alerts.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl shadow-sm print-break-inside-avoid">
                            <h3 className="font-bold text-rose-800 mb-4 flex items-center gap-2 text-sm">
                                <AlertCircle size={18} /> Alertes Stock Magasin (≤ 5)
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

                <div className="flex flex-col gap-6 print:block">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[250px] print-break-inside-avoid print:mb-8">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><Package size={16} className="text-emerald-600"/> Top Produits (Ventes)</h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
                            {charts.topProducts.map((p: any, i: number) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-700">
                                        <span className="truncate w-[65%]">{p.name}</span>
                                        <span className="font-mono text-slate-900 bg-slate-100 px-1.5 rounded">{Number(p.total).toFixed(0)} u</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full"><div className="bg-emerald-600 h-full rounded-full" style={{ width: `${(p.total / (charts.topProducts[0]?.total || 1)) * 100}%` }}></div></div>
                                </div>
                            ))}
                            {charts.topProducts.length === 0 && <p className="text-xs text-slate-400 italic text-center mt-10">Aucune donnée</p>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[250px] print-break-inside-avoid">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><Users size={16} className="text-orange-500"/> Clients à Risque (Dette)</h3>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
                            {charts.topClients.map((c: any, i: number) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-700">
                                        <span className="truncate w-[65%]">{c.name}</span>
                                        <span className="font-mono text-orange-700 bg-orange-50 px-1.5 rounded">{formatCompact(c.total)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full"><div className="bg-orange-500 h-full rounded-full" style={{ width: `${(c.total / (charts.topClients[0]?.total || 1)) * 100}%` }}></div></div>
                                </div>
                            ))}
                            {charts.topClients.length === 0 && <p className="text-xs text-slate-400 italic text-center mt-10">Aucune dette active</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};