import React from 'react';
import { TrendingUp, PieChart, Coins, Package, ShieldCheck } from 'lucide-react';

interface StatsProps {
    metrics: any;
    loading: boolean;
}

export const LegalStats: React.FC<StatsProps> = ({ metrics, loading }) => {
    
    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
        </div>
    );

    if (!metrics) return null;

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n || 0);

    // Extract Tax Data safely
    const tva10 = metrics.taxAnalysis?.tva10 || 0;
    const tva20 = metrics.taxAnalysis?.tva20 || 0;
    const totalTva = metrics.netVAT || 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-2">
            
            {/* 1. NET REVENUE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <TrendingUp size={20}/>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${metrics.netRevenue >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {metrics.netRevenue >= 0 ? 'Positif' : 'Négatif'}
                    </span>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chiffre d'Affaires (Net)</p>
                <h3 className="text-2xl font-black text-slate-800 mt-1">{formatMAD(metrics.netRevenue)}</h3>
                <div className="mt-2 text-[10px] text-slate-400 flex gap-2">
                    <span>Brut: {formatMAD(metrics.grossRevenue)}</span>
                    <span className="text-red-400">Retours: -{formatMAD(metrics.totalRefunds)}</span>
                </div>
            </div>

            {/* 2. GROSS MARGIN (REAL) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Coins size={20}/>
                    </div>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Marge Brute (Réelle)</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{formatMAD(metrics.grossMargin)}</h3>
                <p className="mt-2 text-[10px] text-slate-400">Calculée sur Coût Achat (Silo A)</p>
            </div>

            {/* 3. ✅ FISCAL POSITION (CLEAN LAYOUT) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-300 transition-colors">
                <div className="flex justify-between items-start mb-1">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <ShieldCheck size={20}/>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">TVA à Payer</p>
                        <h3 className="text-xl font-black text-purple-600">{formatMAD(totalTva)}</h3>
                    </div>
                </div>
                
                {/* Visual Ratio Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full flex overflow-hidden mt-3 mb-3">
                    <div className="bg-purple-500 h-full" style={{ width: `${(tva20 / (totalTva || 1)) * 100}%` }}></div>
                    <div className="bg-indigo-400 h-full" style={{ width: `${(tva10 / (totalTva || 1)) * 100}%` }}></div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="block text-slate-400 font-bold uppercase text-[9px]">Taux 20%</span>
                        <span className="block font-bold text-slate-700">{formatMAD(tva20)}</span>
                    </div>
                    <div className="bg-indigo-50 p-1.5 rounded border border-indigo-100">
                        <span className="block text-indigo-400 font-bold uppercase text-[9px]">Taux 10%</span>
                        <span className="block font-bold text-indigo-700">{formatMAD(tva10)}</span>
                    </div>
                </div>
            </div>

            {/* 4. ASSET VALUE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Package size={20}/>
                    </div>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valeur Stock (Silo A)</p>
                <h3 className="text-2xl font-black text-indigo-600 mt-1">{formatMAD(metrics.stockValue)}</h3>
                <p className="mt-2 text-[10px] text-slate-400">Valeur d'inventaire (Prix Achat)</p>
            </div>

        </div>
    );
};