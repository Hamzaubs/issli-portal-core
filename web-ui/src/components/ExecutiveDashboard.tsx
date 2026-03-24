// web-ui/src/components/ExecutiveDashboard.tsx
import React from 'react';
import { Wallet, Users, Package, FileText } from 'lucide-react';

export const ExecutiveDashboard = ({ data }: { data: any }) => {

    const formatMAD = (amount: number) => {
        const num = Number(amount);
        if (isNaN(num)) return "0 MAD";
        if (Math.abs(num) >= 1000000) return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 1, notation: "compact" }).format(num);
        return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(num);
    };

    // ✅ SAFER UNIVERSAL MAPPING
    const realCash = data?.metrics?.treasury?.realCash ?? data?.kpi?.collectedCash ?? 0;
    const totalDue = data?.metrics?.treasury?.totalDue ?? data?.kpi?.periodBalance ?? 0;
    
    // Grabs both values so the card always has data
    const stockValueCost = data?.metrics?.stockValueCost ?? data?.kpi?.stockValue ?? 0;
    const stockValuePotential = data?.metrics?.stockValuePotential ?? data?.kpi?.stockPotential ?? 0;
    
    const totalQuotes = data?.metrics?.pipeline ?? data?.kpi?.totalQuotes ?? 0; 
    const topDebtors = data?.topDebtors || data?.charts?.topClients || [];

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2 mb-2">
                            <Wallet size={14}/> Trésorerie (Flux Net)
                        </h3>
                        <p className="text-3xl font-black tracking-tight">{formatMAD(realCash)}</p>
                    </div>
                    <Wallet size={80} className="absolute -bottom-4 -right-4 text-white/5" />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-orange-600 flex items-center gap-2 mb-2">
                            <Users size={14}/> Argent Dehors (Créances)
                        </h3>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{formatMAD(totalDue)}</p>
                        <span className="inline-block mt-3 px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-lg border border-orange-100">À Recouvrer</span>
                    </div>
                    <Users size={80} className="absolute -bottom-4 -right-4 text-orange-50" />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2 mb-2">
                            <Package size={14}/> Valeur Stock (Achat)
                        </h3>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{formatMAD(stockValueCost)}</p>
                        {/* ✅ Shows the Potential Revenue underneath the actual Cost */}
                        <span className="inline-block mt-3 text-emerald-600 text-[10px] font-bold">Potentiel Vente: {formatMAD(stockValuePotential)}</span>
                    </div>
                    <Package size={80} className="absolute -bottom-4 -right-4 text-slate-50" />
                </div>

                {/* DEVIS PIPELINE CARD */}
                <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-700 flex items-center gap-2 mb-2">
                            <FileText size={14}/> Devis en Attente
                        </h3>
                        <p className="text-3xl font-black text-amber-900 tracking-tight">{formatMAD(totalQuotes)}</p>
                        <span className="inline-block mt-3 px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-200">Pipeline Commercial</span>
                    </div>
                    <FileText size={80} className="absolute -bottom-4 -right-4 text-amber-200/50 transform rotate-12" />
                </div>

            </div>

            {/* DEBTORS TABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <span className="p-1.5 bg-red-100 text-red-600 rounded-lg"><Users size={16}/></span>
                    <h3 className="font-bold text-slate-800">Top 5 Débiteurs (À Relancer)</h3>
                </div>
                {topDebtors.length > 0 ? (
                    <table className="w-full text-sm">
                        <tbody>
                            {topDebtors.map((d: any, i: number) => (
                                <tr key={i} className="border-b border-slate-50">
                                    <td className="p-4 font-bold text-slate-800">{d.name}</td>
                                    <td className="p-4 text-slate-500 font-mono hidden sm:table-cell">{d.phone || '-'}</td>
                                    <td className="p-4 text-right font-black text-red-600">{formatMAD(d.balance || d.total || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center text-slate-400 text-sm font-medium italic">
                        Aucune dette majeure en cours.
                    </div>
                )}
            </div>
        </div>
    );
};