import React, { useState } from 'react';
import { 
    Wallet, TrendingUp, AlertTriangle, Users, Coins, ArrowUpRight, Package
} from 'lucide-react';
import { ClientStatement } from './ClientStatement'; // Ensure this component exists or create a placeholder if not

interface ExecutiveProps {
    data: any; 
}

// 🎨 Lightweight SVG Chart Component (No Libs)
const SimpleLineChart = ({ data }: { data: { date: string, value: number }[] }) => {
    if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-emerald-200/50 text-xs">Pas de données</div>;
    
    const height = 100;
    const width = 300;
    const values = data.map(d => d.value);
    const maxVal = Math.max(...values) || 100;
    const minVal = Math.min(...values) || 0;
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        // Normalize Y to fit height
        const y = height - ((d.value - minVal) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
                <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#6EE7B7" stopOpacity="0"/>
                </linearGradient>
            </defs>
            <path d={`M0,${height} ${points} L${width},${height} Z`} fill="url(#gradient)" />
            <polyline fill="none" stroke="#6EE7B7" strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export const ExecutiveDashboard: React.FC<ExecutiveProps> = ({ data }) => {
    // Determine data source structure (fallback safely)
    const m = data || {}; 
    const [statementClient, setStatementClient] = useState<string | null>(null);
    
    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n || 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* 1. STRATEGIC ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* TRÉSORERIE (CASH FLOW) */}
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={100}/></div>
                    
                    <div className="relative z-10">
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                            <Coins size={14} className="text-emerald-400"/> Trésorerie (Flux Net)
                        </p>
                        <h2 className="text-4xl font-black mt-2 tracking-tight text-white">{formatMAD(m.cashFlow)}</h2>
                        
                        {/* CHART AREA */}
                        <div className="h-16 mt-4 w-full opacity-80">
                            <SimpleLineChart data={m.chartData || []} />
                        </div>
                    </div>
                </div>

                {/* CRÉANCES (MONEY OUT) */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-5"><Users size={100} className="text-orange-600"/></div>
                    
                    <div className="relative z-10">
                        <p className="text-orange-600 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                            <AlertTriangle size={14}/> Argent Dehors (Créances)
                        </p>
                        <h2 className="text-4xl font-black mt-2 text-slate-800">{formatMAD(m.totalReceivables)}</h2>
                        
                        <div className="mt-4 flex gap-2">
                            <div className="px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-100">
                                À Recouvrer
                            </div>
                        </div>
                    </div>
                </div>

                {/* VALEUR STOCK (ASSETS) */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-5"><Package size={100} className="text-blue-600"/></div>
                    
                    <div className="relative z-10">
                        <p className="text-blue-600 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                            <TrendingUp size={14}/> Valeur Stock (Achat)
                        </p>
                        <h2 className="text-4xl font-black mt-2 text-slate-800">{formatMAD(m.stockValueCost)}</h2>
                        
                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-medium">Potentiel Vente</span>
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{formatMAD(m.stockValuePotential)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. TOP DEBTORS LIST */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <div className="bg-red-100 p-1.5 rounded text-red-600"><AlertTriangle size={16}/></div>
                        Top 5 Débiteurs (À Relancer)
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="p-4">Client</th>
                                <th className="p-4 text-right">Dette (Balance)</th>
                                <th className="p-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {m.topDebtors && m.topDebtors.length > 0 ? m.topDebtors.map((c: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-700">{c.name}</div>
                                        <div className="text-xs text-slate-400 font-mono">{c.phone || '-'}</div>
                                    </td>
                                    <td className="p-4 text-right font-mono font-black text-red-600 text-base">{formatMAD(c.balance)}</td>
                                    <td className="p-4 text-right">
                                        {/* Trigger Statement Modal */}
                                        <button onClick={() => setStatementClient(c.id)} 
                                            className="text-[10px] bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white font-bold transition-all shadow-sm flex items-center gap-2 ml-auto">
                                            <FileText size={12}/> RELEVÉ
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">Aucune dette majeure en cours.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Statement Modal */}
            {statementClient && (
                // Safe check if component exists, otherwise placeholder alert
                typeof ClientStatement !== 'undefined' ? 
                <ClientStatement clientId={statementClient} onClose={() => setStatementClient(null)} /> : 
                null
            )}
        </div>
    );
};