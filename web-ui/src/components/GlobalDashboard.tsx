// web-ui/src/components/GlobalDashboard.tsx
import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { 
    LayoutDashboard, AlertTriangle, Building2, Calendar, RefreshCcw, 
    BarChart3, ShieldCheck, Wallet, XCircle, FileText, Search, Activity
} from 'lucide-react';

// ✅ IMPORT THE DRILL-DOWN COMPONENTS
import { LegalAnalytics } from './LegalAnalytics'; 
import { InternalAnalytics } from './InternalAnalytics';

export const GlobalDashboard = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); 
  
  // 🎯 DRILL-DOWN STATE
  const [drillDown, setDrillDown] = useState<'NONE' | 'SILO_A' | 'SILO_B'>('NONE');
  
  const [dateRange, setDateRange] = useState({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
      document.title = "ISSLI PECHE - STOCK GLOBALE";
  }, []);

  const fetchData = () => {
    setLoading(true);
    setError('');
    
    const token = localStorage.getItem('marine_token');
    if (!token) {
        setError("Pas de token de session.");
        setLoading(false);
        return;
    }

    client.get(`/dashboard/stats?from=${dateRange.from}&to=${dateRange.to}`)
    .then(res => {
        if (res.data && res.data.metrics && res.data.charts) setData(res.data);
        else throw new Error("Format de données invalide reçu du serveur.");
    })
    .catch(err => {
        console.error("Dashboard Load Error:", err);
        setError(`Erreur: ${err.response?.data?.error || err.message}`);
    })
    .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [dateRange]);

  const formatMAD = (amount: number) => {
      const num = Number(amount);
      if (isNaN(num)) return "0 MAD";
      if (Math.abs(num) >= 1000000) return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 1, notation: "compact" }).format(num);
      return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(num);
  };

  // 🎯 RENDER DRILL-DOWNS IF ACTIVE
  if (drillDown === 'SILO_A') return <LegalAnalytics onBack={() => setDrillDown('NONE')} />;
  if (drillDown === 'SILO_B') return <InternalAnalytics onBack={() => setDrillDown('NONE')} />;

  if (loading) return <div className="absolute inset-0 bg-slate-900 flex items-center justify-center text-slate-500 font-mono tracking-widest animate-pulse">CHARGEMENT DES DONNÉES...</div>;

  if (error || !data || !data.metrics) return (
    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white space-y-6 p-4">
        <div className="bg-red-500/10 p-6 rounded-full text-red-500 animate-pulse"><XCircle size={64} /></div>
        <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">Echec du Chargement</h3>
            <p className="text-red-400 font-mono bg-red-950/50 p-2 rounded border border-red-900">{error}</p>
        </div>
        <button onClick={fetchData} className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-all flex items-center gap-2">
            <RefreshCcw size={20} /> Réessayer
        </button>
    </div>
  );

  const { metrics, charts = [] } = data;
  
  const maxChartValue = charts.length > 0 
    ? Math.max(...charts.map((d: any) => Math.max(0, (d.internalSales || 0) - (d.internalRefunds || 0)) + Math.max(0, d.legal || 0))) 
    : 1;

  return (
    <div className="absolute inset-0 bg-slate-900 text-white overflow-auto font-sans">
      <div className="p-8 max-w-[1600px] mx-auto">
        
        {/* HEADER & CONTROLS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10 border-b border-slate-800 pb-8">
            
            {/* TITLE BLOCK */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
                    <LayoutDashboard size={28} strokeWidth={2} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight uppercase">ISSLI PECHE ERP</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></span>
                        <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest">TABLEAU DE BORD (A + B)</p>
                    </div>
                </div>
            </div>

            {/* 🎯 DRILL-DOWN QUICK ACTION BUTTONS */}
            <div className="flex gap-3">
                <button onClick={() => setDrillDown('SILO_A')} className="px-4 py-2 bg-blue-900/30 hover:bg-blue-600 border border-blue-800/50 hover:border-blue-500 text-blue-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm">
                    <Search size={14}/> Explorer Silo A
                </button>
                <button onClick={() => setDrillDown('SILO_B')} className="px-4 py-2 bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-800/50 hover:border-emerald-500 text-emerald-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm">
                    <Activity size={14}/> Explorer Silo B
                </button>
            </div>

            {/* DATE FILTERS */}
            <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700">
                <div className="flex items-center px-3 py-2 bg-slate-800 rounded-lg border border-slate-600/50">
                    <Calendar size={16} className="text-slate-400 mr-2" />
                    <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="bg-transparent border-none text-white text-xs font-bold focus:ring-0 outline-none uppercase" />
                </div>
                <span className="text-slate-500 font-black">➜</span>
                <div className="flex items-center px-3 py-2 bg-slate-800 rounded-lg border border-slate-600/50">
                    <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="bg-transparent border-none text-white text-xs font-bold focus:ring-0 outline-none uppercase" />
                </div>
                <button onClick={fetchData} className="p-2.5 bg-blue-600 rounded-lg hover:bg-blue-500 transition-all shadow-lg"><RefreshCcw size={16} /></button>
            </div>
        </div>

        {/* 1. TOP ROW: REVENUE & TREASURY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2 bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Chiffre d'Affaires Global</p>
                        <h2 className="text-5xl font-black tracking-tight text-white mt-2">{formatMAD(metrics.totalCA)}</h2>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Building2 size={32} /></div>
                </div>
                <div className="flex gap-8 mt-6">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">STOCK A (Facturé)</p>
                            <p className="text-lg font-bold text-blue-400">{formatMAD(metrics.split?.legal || 0)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-8 bg-emerald-500 rounded-full"></div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">STOCK B (Comptoir)</p>
                            <p className="text-lg font-bold text-emerald-400">{formatMAD(metrics.split?.cash || 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Trésorerie Globale (A + B)</p>
                    <Wallet className="text-emerald-500" size={28} />
                </div>
                <div>
                    <h2 className="text-4xl font-black text-emerald-500">{formatMAD(metrics.treasury?.realCash || 0)}</h2>
                    <p className="text-xs text-slate-500 font-bold mt-2 uppercase">Virements & Espèces</p>
                </div>
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-700/50 text-xs font-bold">
                    <div className="flex justify-between text-slate-400">
                        <span>Chèques en main (B):</span> <span className="text-white">{formatMAD(metrics.treasury?.checks || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                        <span>Dette Clients (A + B):</span> 
                        <span className="text-red-500">{formatMAD(metrics.treasury?.totalDue || 0)}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* 2. MIDDLE ROW: PROFITS, ALERTS & DEVIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${metrics.totalProfits >= 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Marge Nette (A + B)</p>
                        <h3 className={`text-3xl font-black ${metrics.totalProfits >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {formatMAD(metrics.totalProfits)}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500"><FileText size={24} /></div>
                    <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Pipeline (Devis B)</p>
                        <h3 className="text-3xl font-black text-amber-500">{formatMAD(metrics.pipeline || 0)}</h3>
                    </div>
                </div>
            </div>

            <div className={`p-6 rounded-2xl border flex items-center justify-between transition-colors ${metrics.alertsCount > 0 ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-700/50 bg-slate-800/30'}`}>
                 <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${metrics.alertsCount > 0 ? 'bg-orange-500 text-slate-900' : 'bg-slate-700/50 text-slate-400'}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase ${metrics.alertsCount > 0 ? 'text-orange-400' : 'text-slate-500'}`}>Alertes de Stock</p>
                        <h3 className={`text-2xl font-black ${metrics.alertsCount > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
                            {metrics.alertsCount > 0 ? `${metrics.alertsCount} Produits Critique` : 'Sécurisé'}
                        </h3>
                    </div>
                </div>
            </div>
        </div>

        {/* 3. MAIN CHART: REVENUE EVOLUTION */}
        <div className="bg-slate-800/30 border border-slate-800 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <BarChart3 className="text-slate-400" />
                    <h3 className="font-bold text-lg text-white uppercase tracking-wide">Évolution du CA (Net)</h3>
                </div>
                <div className="flex gap-4 text-xs font-bold uppercase">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600"></span> STOCK A</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> STOCK B</div>
                </div>
            </div>
            
            <div className="h-72 w-full flex items-end gap-3">
                {charts.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 font-mono text-sm tracking-widest">
                        AUCUNE DONNÉE SUR CETTE PÉRIODE
                    </div>
                ) : (
                    charts.map((day: any) => {
                        const netInternal = Math.max(0, (day.internalSales || 0) - (day.internalRefunds || 0));
                        const safeLegal = Math.max(0, day.legal || 0);
                        const totalVisualVolume = netInternal + safeLegal;
                        const heightPct = maxChartValue > 0 ? (totalVisualVolume / maxChartValue) * 100 : 0;
                        
                        return (
                            <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-3 bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-2xl text-xs whitespace-nowrap hidden group-hover:block z-20 pointer-events-none min-w-[150px]">
                                    <div className="font-bold text-white mb-2 border-b border-slate-800 pb-1">{day.date}</div>
                                    <div className="flex justify-between gap-4 text-blue-400"><span>STOCK A:</span> <span>{formatMAD(safeLegal)}</span></div>
                                    <div className="mt-1 pt-1 border-t border-slate-800/50">
                                        <div className="flex justify-between gap-4 text-emerald-400 font-bold"><span>STOCK B:</span> <span>{formatMAD(netInternal)}</span></div>
                                    </div>
                                    <div className="mt-2 pt-1 border-t border-slate-800 flex justify-between gap-4 text-white font-bold">
                                        <span>Total:</span> <span>{formatMAD(safeLegal + netInternal)}</span>
                                    </div>
                                </div>
                                {/* Stacked Bar */}
                                <div className="w-full max-w-[50px] bg-slate-700/30 rounded-t-sm overflow-hidden flex flex-col-reverse transition-all duration-500 hover:brightness-125" 
                                     style={{ height: `${Math.max(2, heightPct)}%` }}>
                                    <div style={{ flex: netInternal }} className="bg-emerald-500 w-full transition-all"></div>
                                    <div style={{ flex: safeLegal }} className="bg-blue-600 w-full transition-all"></div>
                                </div>
                                <span className="mt-3 text-[10px] text-slate-500 font-mono rotate-45 md:rotate-0 origin-left">{day.date.slice(5)}</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
      </div>
    </div>
  );
};