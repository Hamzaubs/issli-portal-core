// web-ui/src/components/LegalDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, ArrowLeft, ArrowRight,
    Printer, FileBarChart, ShieldCheck,
    CheckCircle2, Settings, Package, Undo2,
    AlertCircle, Coins, FileText, Wallet, AlertTriangle, X,
    ArrowRightLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client'; 
import { InvoiceWizard } from './InvoiceWizard'; 
import { AssetForm } from './AssetForm';
import { AssetImport } from './AssetImport';
import { InvoicePrint } from './InvoicePrint';
import { StockTableLegal } from './StockTableLegal';
import { LegalAnalytics } from './LegalAnalytics';
import { SettingsPage } from './SettingsPage';

interface Invoice {
    id: string; reference: string; client: { name: string; ice: string; address?: string };
    totalHT: number; totalTTC: number; amountPaid: number; issuedAt: string; 
    status: 'PAYEE' | 'ANNULEE' | 'AVOIR_EMIS' | 'DEVIS' | 'EN_ATTENTE'; items: any[]; type: string;
}

export const LegalDashboard = () => {
    // 🛡️ RBAC: Security Check
    const currentUser = JSON.parse(localStorage.getItem('marine_user') || '{}');
    const isAdmin = currentUser.role === 'SUPER_ADMIN';

    const navigate = useNavigate(); 
    const [activeTab, setActiveTab] = useState<'invoices' | 'assets'>('invoices');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'QUOTES' | 'PAID'>('ALL');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    const [stats, setStats] = useState({ revenueToday: 0, totalDebt: 0, quotesVolume: 0 });
    
    const [viewMode, setViewMode] = useState<'DASHBOARD' | 'ANALYTICS'>('DASHBOARD');
    const [wizardMode, setWizardMode] = useState<'NONE' | 'INVOICE' | 'QUOTE' | 'CREDIT_NOTE'>('NONE');
    
    const [showAssetForm, setShowAssetForm] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [printInvoiceData, setPrintInvoiceData] = useState<Invoice | null>(null);
    
    // Payment Modal State
    const [paymentModalData, setPaymentModalData] = useState<{id: string, ref: string, remaining: number} | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    
    const [stockRefreshTrigger, setStockRefreshTrigger] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPagination(prev => ({ ...prev, page: 1 })); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchData = async () => {
        try {
            if (activeTab === 'invoices') {
                const res = await client.get(`/legal/documents?page=${pagination.page}&limit=10&search=${debouncedSearch}`);
                if (res.data && Array.isArray(res.data.data)) {
                    setInvoices(res.data.data);
                    setPagination(prev => ({ ...prev, ...res.data.meta }));
                }
               const statRes = await client.get('/legal/stats');
               setStats(statRes.data.kpi || { revenueToday: 0, totalDebt: 0, quotesVolume: 0 });
            }
        } catch (error) { console.error(error); } 
    };

    useEffect(() => { 
        if (viewMode === 'DASHBOARD') fetchData(); 
    }, [viewMode, pagination.page, debouncedSearch, activeTab]);
    
    const filteredInvoices = invoices.filter(inv => {
        if (statusFilter === 'ALL') return true;
        if (statusFilter === 'QUOTES') return inv.type === 'DEVIS';
        if (statusFilter === 'PAID') return inv.status === 'PAYEE';
        if (statusFilter === 'UNPAID') return (inv.type === 'FACTURE' && (inv.totalTTC - inv.amountPaid) > 0.5 && inv.status !== 'ANNULEE');
        return true;
    });

    const handleCancel = async (id: string) => {
        if (!window.confirm("⚠️ ATTENTION : Annuler cette vente ?")) return;
        try { 
            await client.post(`/legal/invoices/${id}/credit-note`); 
            await fetchData(); 
            setStockRefreshTrigger(prev => prev + 1); 
        } catch (err: any) { alert("Erreur: " + err.response?.data?.error); }
    };

   const handleAddPayment = async () => {
        if (!paymentModalData || !paymentAmount) return;
        const amountNum = parseFloat(paymentAmount);
        
        if (amountNum <= 0) {
            return alert("Le montant doit être supérieur à 0 MAD.");
        }
        if (amountNum > paymentModalData.remaining + 0.05) {
            return alert(`⚠️ BLOQUÉ : Impossible de payer plus que le reste à payer (${formatMAD(paymentModalData.remaining)}).`);
        }

        try {
            await client.post(`/legal/invoices/${paymentModalData.id}/payment`, {
                amount: amountNum, method: 'ESPECES', note: 'Réglement depuis dashboard'
            });
            setPaymentModalData(null); setPaymentAmount('');
            fetchData();
        } catch (err: any) { 
            alert("Erreur Serveur: " + err.response?.data?.error); 
        }
    };

    const formatMAD = (n: any) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(Number(n));

    if (viewMode === 'ANALYTICS') return <LegalAnalytics onBack={() => setViewMode('DASHBOARD')} />;

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50/50 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                         <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
                            <ShieldCheck size={24} />
                         </div>
                         STOCK A (Bureau Légal)
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium pl-14">Facturation Officielle, TVA & Stock Réglementaire.</p>
                </div>
                
                <div className="flex gap-3 relative z-10">
                    <button onClick={() => setShowSettings(true)} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl"><Settings size={20} /></button>
                    <button onClick={() => setViewMode('ANALYTICS')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100"><FileBarChart size={18} /> Analytique</button>
                    
                    {activeTab === 'assets' ? (
                         <>
                            {/* 🛡️ RBAC: Hide Import and Add from non-admins */}
                            {isAdmin && (
                                <>
                                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Import Excel</button>
                                    <button onClick={() => setShowAssetForm(true)} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95"><Package size={20} /> Nouveau Produit (A)</button>
                                </>
                            )}
                         </>
                    ) : (
                        <>
                            <button 
                                onClick={() => navigate('/legal/exchange')} 
                                className="flex items-center gap-2 px-5 py-2 bg-purple-100 text-purple-700 font-bold rounded-xl hover:bg-purple-200 active:scale-95 border border-purple-200"
                            >
                                <ArrowRightLeft size={20} /> Retours & Échanges
                            </button>

                            <button 
                                onClick={() => setWizardMode('QUOTE')} 
                                className="flex items-center gap-2 px-5 py-2 bg-amber-100 text-amber-700 font-bold rounded-xl hover:bg-amber-200 active:scale-95 border border-amber-200 shadow-sm cursor-pointer"
                            >
                                <FileText size={20} /> Nouveau Devis
                            </button>
                            
                            <button 
                                onClick={() => setWizardMode('INVOICE')} 
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95"
                            >
                                <Plus size={20} /> Nouvelle Vente
                            </button>
                        </>
                    )}
                </div>
            </div>

            {activeTab === 'invoices' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Wallet size={24}/></div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Encaissement (Jour)</p>
                            <p className="text-2xl font-black text-slate-800">{formatMAD(stats.revenueToday)}</p>
                        </div>
                    </div>
                    
                    <div onClick={() => navigate('/legal/clients')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-red-200 transition-colors group">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform"><AlertTriangle size={24}/></div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Créances Clients</p>
                            <p className="text-2xl font-black text-red-600">{formatMAD(stats.totalDebt)}</p>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><FileText size={24}/></div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Devis en Cours</p>
                            <p className="text-2xl font-black text-slate-800">{formatMAD(stats.quotesVolume)}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                
                <div className="border-b border-slate-100 p-4 flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'invoices' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Historique Ventes</button>
                        <button onClick={() => setActiveTab('assets')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'assets' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>STOCK A (Produits)</button>
                    </div>

                    {activeTab === 'invoices' && (
                        <div className="flex gap-2">
                            <button onClick={() => setStatusFilter('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${statusFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>Tout</button>
                            <button onClick={() => setStatusFilter('UNPAID')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${statusFilter === 'UNPAID' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-200'}`}>Impayés</button>
                            <button onClick={() => setStatusFilter('QUOTES')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${statusFilter === 'QUOTES' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>Devis</button>
                            <button onClick={() => setStatusFilter('PAID')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${statusFilter === 'PAID' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>Payés</button>
                        </div>
                    )}

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {activeTab === 'assets' ? (
                        <StockTableLegal refreshTrigger={stockRefreshTrigger} /> 
                    ) : (
                        <>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-4">Réf</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Client</th>
                                        <th className="p-4 text-right">Montant TTC</th>
                                        <th className="p-4 text-center">Statut</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredInvoices.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-400 italic">Aucun résultat.</td></tr> : filteredInvoices.map(inv => {
                                        const remaining = inv.totalTTC - (Number(inv.amountPaid) || 0);
                                        const isUnpaid = remaining > 0.5;
                                        return (
                                            <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="p-4 font-mono font-bold text-blue-900">{inv.reference}</td>
                                                <td className="p-4 text-slate-500">{new Date(inv.issuedAt).toLocaleDateString('fr-MA')}</td>
                                                <td className="p-4 font-bold text-slate-800">{inv.client?.name}</td>
                                                <td className="p-4 text-right font-bold text-slate-900">{formatMAD(inv.totalTTC)}</td>
                                                <td className="p-4 text-center">
                                                    {inv.status === 'AVOIR_EMIS' ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700"><Undo2 size={12}/> REMBOURSÉ</span>
                                                    : inv.type === 'AVOIR' ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">AVOIR (Crédit)</span>
                                                    : isUnpaid && inv.type !== 'DEVIS' ? <div className="flex flex-col items-start"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700"><AlertCircle size={12}/> Reste: {formatMAD(remaining)}</span></div>
                                                    : inv.type === 'DEVIS' ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700"><FileText size={12}/> DEVIS</span>
                                                    : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 size={12}/> PAYÉE</span>}
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setPrintInvoiceData(inv)} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Printer size={18} /></button>
                                                    {inv.type === 'FACTURE' && isUnpaid && (
                                                        <button onClick={() => { setPaymentAmount(remaining.toString()); setPaymentModalData({ id: inv.id, ref: inv.reference, remaining }); }} 
                                                            className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"><Coins size={18} /></button>
                                                    )}
                                                    {/* 🛡️ RBAC: Only Admin can cancel */}
                                                    {isAdmin && inv.type === 'FACTURE' && <button onClick={() => handleCancel(inv.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Undo2 size={18} /></button>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                                <p className="text-xs text-slate-500">Page {pagination.page} / {pagination.totalPages}</p>
                                <div className="flex gap-2">
                                    <button disabled={pagination.page <= 1} onClick={() => setPagination(p => ({...p, page: p.page - 1}))} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"><ArrowLeft size={16}/></button>
                                    <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination(p => ({...p, page: p.page + 1}))} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"><ArrowRight size={16}/></button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* MODALS */}
            {wizardMode !== 'NONE' && (
                <InvoiceWizard 
                    mode={wizardMode as any} 
                    onCancel={() => setWizardMode('NONE')} 
                    onSuccess={() => { 
                        setWizardMode('NONE'); 
                        fetchData(); 
                        setStockRefreshTrigger(p => p + 1); 
                    }} 
                />
            )}
            
            {showAssetForm && <AssetForm onCancel={() => setShowAssetForm(false)} onSuccess={() => { setShowAssetForm(false); setStockRefreshTrigger(prev => prev + 1); }} />}
            {showImportModal && <AssetImport onCancel={() => setShowImportModal(false)} onSuccess={() => { setShowImportModal(false); setStockRefreshTrigger(prev => prev + 1); }} />}
            {showSettings && <SettingsPage onClose={() => { setShowSettings(false); fetchData(); }} />} 
            {printInvoiceData && <InvoicePrint invoice={printInvoiceData} onClose={() => setPrintInvoiceData(null)} />}
            
            {paymentModalData && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg text-slate-800">Réglement</h3><button onClick={() => setPaymentModalData(null)}><X size={20} className="text-slate-400"/></button></div>
                        <div className="mb-4"><p className="text-sm text-slate-500">Reste: <span className="font-bold text-red-600">{formatMAD(paymentModalData.remaining)}</span></p></div>
                        <div className="mb-6"><input autoFocus type="number" max={paymentModalData.remaining} step="0.01" className="w-full pl-4 py-3 border border-slate-300 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                        <button onClick={handleAddPayment} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">Confirmer</button>
                    </div>
                </div>
            )}
        </div>
    );
};