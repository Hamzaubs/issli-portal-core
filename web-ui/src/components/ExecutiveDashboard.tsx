// web-ui/src/components/ExecutiveDashboard.tsx
import React, { useState } from 'react';
import { Wallet, Users, Package, FileText, BarChart3, Calculator, ShieldCheck } from 'lucide-react';
import { DailyTillModal } from './DailyTillModal';

export const ExecutiveDashboard = ({ data }: { data: any }) => {

    const [showTillModal, setShowTillModal] = useState(false);

    // 🛡️ SECURITY FIX: The Invincible NaN Shield
    const formatMAD = (amount: any) => {
        let num = 0;
        if (amount !== null && amount !== undefined) {
            if (typeof amount === 'object') {
                num = Number(amount.toString());
            } else if (typeof amount === 'string') {
                num = Number(amount.replace(/[^0-9.-]+/g, ""));
            } else {
                num = Number(amount);
            }
        }
        
        if (isNaN(num)) num = 0;

        if (Math.abs(num) >= 1000000) {
            return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 1, notation: "compact" }).format(num);
        }
        return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };

    // ✅ SAFER UNIVERSAL MAPPING (Aligned with Master Analytics)
    const realCash = data?.metrics?.treasury?.realCash ?? data?.kpi?.collectedCash ?? 0;
    const totalDue = data?.metrics?.treasury?.totalDue ?? data?.kpi?.periodBalance ?? 0;
    
    // Revenue & TVA Tracking
    const totalCaTTC = data?.metrics?.revenue?.totalTTC ?? data?.kpi?.totalCA ?? 0;
    const totalCaHT = data?.metrics?.revenue?.totalHT ?? 0;
    const totalTVA = data?.metrics?.revenue?.totalTVA ?? 0;
    
    // Stock Valuations
    const stockValueCost = data?.metrics?.stockValueCost ?? data?.kpi?.stockValue ?? 0;
    const stockValuePotential = data?.metrics?.stockValuePotential ?? data?.kpi?.stockPotential ?? 0;
    
    const topDebtors = data?.topDebtors || data?.charts?.topClients || [];

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* 📊 THE NEW MASTER REVENUE CARD */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between border border-slate-800">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2 mb-2">
                            <BarChart3 size={14}/> Chiffre d'Affaires
                        </h3>
                        <p className="text-3xl font-black tracking-tight">{formatMAD(totalCaTTC)} <span className="text-[10px] font-bold text-slate-400 uppercase">TTC</span></p>
                        
                        <div className="mt-4 space-y-1 border-t border-slate-700/50 pt-3">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                <span>CA Net (HT)</span>
                                <span className="font-mono text-slate-300">{formatMAD(totalCaHT)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                <span>TVA Collectée</span>
                                <span className="font-mono text-emerald-400">{formatMAD(totalTVA)}</span>
                            </div>
                        </div>
                    </div>
                    <BarChart3 size={100} className="absolute -bottom-6 -right-6 text-white/5" />
                </div>

                {/* 💵 PHYSICAL CASH CARD */}
                <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 flex items-center gap-2 mb-2">
                            <Wallet size={14}/> Trésorerie (Flux Physique)
                        </h3>
                        <p className="text-3xl font-black text-emerald-950 tracking-tight">{formatMAD(realCash)}</p>
                        
                        {/* ✅ THE DAILY TILL ACTION BUTTON */}
                        <button 
                            onClick={() => setShowTillModal(true)} 
                            className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
                        >
                            <ShieldCheck size={14}/> Clôturer Caisse (Z)
                        </button>
                    </div>
                    <Wallet size={80} className="absolute -bottom-4 -right-4 text-emerald-200/40 pointer-events-none" />
                </div>

                {/* ⚠️ DEBT CARD */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-orange-600 flex items-center gap-2 mb-2">
                            <Users size={14}/> Argent Dehors (Créances)
                        </h3>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{formatMAD(totalDue)}</p>
                        <span className="inline-flex mt-3 px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-lg border border-orange-100 items-center w-max gap-1">
                            <Calculator size={10}/> Solde à Recouvrer
                        </span>
                    </div>
                    <Users size={80} className="absolute -bottom-4 -right-4 text-orange-50 pointer-events-none" />
                </div>

                {/* 📦 STOCK VALUE CARD */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2 mb-2">
                            <Package size={14}/> Valeur Stock (Achat)
                        </h3>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{formatMAD(stockValueCost)}</p>
                        <span className="inline-block mt-3 text-emerald-600 text-[10px] font-bold bg-slate-50 px-2 py-1 rounded border border-slate-100">
                            Potentiel Vente (TTC): {formatMAD(stockValuePotential)}
                        </span>
                    </div>
                    <Package size={80} className="absolute -bottom-4 -right-4 text-slate-50 pointer-events-none" />
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
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
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

            {/* ✅ THE AUTONOMOUS TILL MODAL */}
            {showTillModal && <DailyTillModal onClose={() => setShowTillModal(false)} />}
        </div>
    );
};