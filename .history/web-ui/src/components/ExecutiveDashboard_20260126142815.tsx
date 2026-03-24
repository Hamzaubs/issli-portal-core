// apps/web-ui/src/components/ExecutiveDashboard.tsx
import React, { useState } from 'react';
import { 
    Wallet, TrendingUp, AlertTriangle, Users, Coins 
} from 'lucide-react';
import { ClientStatement } from './ClientStatement'; // ✅ Import

interface ExecutiveProps {
    data: any; 
}

export const ExecutiveDashboard: React.FC<ExecutiveProps> = ({ data }) => {
    const m = data?.metrics || {};
    const [statementClient, setStatementClient] = useState<string | null>(null); // ✅ State
    
    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* 1. STRATEGIC ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* CAISSE RÉELLE */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-20"><Wallet size={80}/></div>
                    <p className="text-emerald-100 font-bold uppercase tracking-widest text-xs">Trésorerie (Caisse Physique)</p>
                    <h2 className="text-4xl font-black mt-2">{formatMAD(m.cashInHand || 0)}</h2>
                    <p className="text-emerald-200 text-xs mt-2 flex items-center gap-1 font-medium">
                        <Coins size={14}/> Disponible immédiatement
                    </p>
                </div>

                {/* CRÉANCES */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-5"><Users size={80} className="text-red-600"/></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Argent Dehors (Créances)</p>
                    <h2 className="text-4xl font-black mt-2 text-red-600">{formatMAD(m.totalClientDebt || 0)}</h2>
                    <p className="text-slate-400 text-xs mt-2 flex items-center gap-1">
                        <AlertTriangle size={14}/> Total dû par les clients
                    </p>
                </div>

                {/* VALEUR TOTALE */}
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-6 opacity-20"><TrendingUp size={80}/></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Valeur Totale (Stock + Cash)</p>
                    <h2 className="text-3xl font-black mt-2">{formatMAD((m.stockValueLegal || 0) + (m.stockValueInternal || 0) + (m.cashInHand || 0))}</h2>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-[10px] text-slate-300 border-t border-slate-700 pt-2">
                        <div>
                            <span className="block opacity-50">Stock Légal (A)</span>
                            <span className="font-bold">{formatMAD(m.stockValueLegal)}</span>
                        </div>
                        <div>
                            <span className="block opacity-50">Stock Interne (B)</span>
                            <span className="font-bold">{formatMAD(m.stockValueInternal)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. TOP DEBTORS LIST */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={20}/> Top 5 Débiteurs (À Relancer)
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
                                <tr key={i} className="hover:bg-red-50/30 transition-colors group">
                                    <td className="p-4 font-bold text-slate-700">{c.name}</td>
                                    <td className="p-4 text-right font-mono font-black text-red-600 text-lg">{formatMAD(c.balance)}</td>
                                    <td className="p-4 text-right">
                                        {/* ✅ BUTTON TRIGGERS STATEMENT */}
                                        <button onClick={() => setStatementClient(c.id)} 
                                            className="text-[10px] bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-600 hover:text-white font-bold transition-all shadow-sm">
                                            RELANCER
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

            {/* ✅ MODAL RENDER */}
            {statementClient && <ClientStatement clientId={statementClient} onClose={() => setStatementClient(null)} />}
        </div>
    );
};