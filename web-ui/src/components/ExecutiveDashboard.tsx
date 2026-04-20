// web-ui/src/components/ExecutiveDashboard.tsx
import React, { useState } from 'react';
import { Wallet, Users, Package, BarChart3, Calculator, ShieldCheck, TrendingUp } from 'lucide-react';
import { DailyTillModal } from './DailyTillModal';

export const ExecutiveDashboard = ({ data }: { data: any }) => {
    const [showTillModal, setShowTillModal] = useState(false);

    const formatMAD = (amount: any) => {
        let num = Number(amount) || 0;
        if (Math.abs(num) >= 1000000) {
            return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 1, notation: "compact" }).format(num);
        }
        return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };

    const realCash = data?.metrics?.treasury?.realCash ?? 0;
    const clientDebt = data?.metrics?.treasury?.totalDue ?? 0;
    const totalCaTTC = data?.metrics?.totalCA ?? 0;
    const totalProfits = data?.metrics?.totalProfits ?? 0;
    const stockValueCost = data?.metrics?.stockValueCost ?? 0;
    const topDebtors = data?.topDebtors || [];

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 📊 REVENUE & PROFITS */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2 mb-2">
                            <BarChart3 size={14}/> Chiffre d'Affaires
                        </h3>
                        <p className="text-3xl font-black">{formatMAD(totalCaTTC)}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <TrendingUp size={12}/> Marge Brute Est.
                        </span>
                        <span className={`font-mono font-bold ${totalProfits >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatMAD(totalProfits)}
                        </span>
                    </div>
                </div>

                {/* 💵 CASH DRAWER */}
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase text-emerald-700 flex items-center gap-2 mb-2">
                            <Wallet size={14}/> Caisse (Espèces)
                        </h3>
                        <p className="text-3xl font-black text-emerald-950">{formatMAD(realCash)}</p>
                    </div>
                    <button 
                        onClick={() => setShowTillModal(true)} 
                        className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                    >
                        <ShieldCheck size={14}/> Clôturer Caisse (Z)
                    </button>
                </div>

                {/* ⚠️ CLIENT DEBT */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase text-orange-600 flex items-center gap-2 mb-2">
                            <Users size={14}/> Créances Clients
                        </h3>
                        <p className="text-3xl font-black text-slate-800">{formatMAD(clientDebt)}</p>
                    </div>
                    <span className="mt-4 inline-flex px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-lg border border-orange-100 items-center w-max gap-1">
                        <Calculator size={10}/> À Recouvrer
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-600 flex items-center gap-2 mb-1">
                            <Package size={14}/> Valeur Actuelle du Stock
                        </h3>
                        <p className="text-2xl font-black text-slate-900">{formatMAD(stockValueCost)}</p>
                    </div>
                    <Package size={40} className="text-slate-100" />
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 text-sm">Top Débiteurs</div>
                    <table className="w-full text-sm">
                        <tbody>
                            {topDebtors.map((d: any, i: number) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-3 font-bold text-slate-700">{d.name}</td>
                                    <td className="p-3 text-right font-black text-red-600">{formatMAD(d.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showTillModal && <DailyTillModal onClose={() => setShowTillModal(false)} />}
        </div>
    );
};