// web-ui/src/components/LegalClientProfile.tsx
import React, { useEffect, useState } from 'react';
import { 
    X, Phone, Printer, ShieldAlert,
    Loader2, Banknote, Building2, Ban, PieChart, CheckCircle2, FileText, ChevronDown, History
} from 'lucide-react';
import client from '../api/client';
import { ClientStatement } from './ClientStatement';
import { LegalPaymentModal } from './LegalPaymentModal';
import { InvoicePrint } from './InvoicePrint'; 
import { LegalLegacyDebtModal } from './LegalLegacyDebtModal';

interface Props {
    clientId: string;
    onClose: () => void;
}

export const LegalClientProfile: React.FC<Props> = ({ clientId, onClose }) => {
    const [profile, setProfile] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filterType, setFilterType] = useState('');
    const [totalPages, setTotalPages] = useState(1);

    const [showStatement, setShowStatement] = useState(false);
    const [selectedLegalInvoice, setSelectedLegalInvoice] = useState<any>(null); 
    const [printData, setPrintData] = useState<any>(null);
    
    // 🆕 Legacy Debt Modal State
    const [showLegacyDebtModal, setShowLegacyDebtModal] = useState(false);

    const loadProfile = async () => {
        try {
            const res = await client.get(`/clients/${clientId}/global-details`);
            setProfile(res.data.profile);
            setStats(res.data.stats);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const loadHistory = async (pageNum: number, reset = false) => {
        if (pageNum === 1 && !reset) setLoading(true); 
        else if (pageNum > 1) setLoadingMore(true);

        try {
            const res = await client.get(`/clients/${clientId}/history?page=${pageNum}&limit=15&type=${filterType}`);
            if (reset) { setHistory(res.data.data); } else { setHistory(prev => [...prev, ...res.data.data]); }
            setTotalPages(res.data.meta.pages);
            setPage(pageNum);
        } catch (e) { console.error(e); } finally { setLoading(false); setLoadingMore(false); }
    };

    useEffect(() => { loadProfile(); loadHistory(1, true); }, [clientId]); 
    useEffect(() => { loadHistory(1, true); }, [filterType]);

    const handleOpenLegalCollection = () => {
        // ✅ Strictly checks for DGI valid unpaid states
        const unpaidLegal = history.find(h => 
            ['EN_ATTENTE', 'PARTIEL'].includes(h.status) && 
            h.type === 'SALE_CASH'
        );
        if (unpaidLegal) { 
            setSelectedLegalInvoice(unpaidLegal); 
        } else { 
            alert("Aucune facture impayée trouvée dans l'historique récent."); 
        }
    };

    const handlePrintLegal = async (doc: any) => {
        try {
            const res = await client.get(`/legal/invoices/${doc.id}`);
            setPrintData({
                ...res.data,
                client: profile, 
                paymentMode: doc.paymentMethod 
            });
        } catch (e) {
            alert("Erreur lors du chargement du document pour impression.");
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    // 🛡️ STRICT STATE MACHINE CHECKERS
    const isCancelled = (status: string) => ['ANNULEE', 'CANCELLED', 'AVOIR_EMIS'].includes(status);
    const isPaid = (status: string) => ['PAYEE', 'PAID'].includes(status);
    const isPartial = (status: string) => ['PARTIEL', 'PAYEE_PARTIELLEMENT'].includes(status);
    
    // Safety check for debt display
    const isGlobalDebtPayable = stats?.currentDebt > 0.05;

    if (loading && !profile) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm text-white font-bold"><Loader2 className="animate-spin mr-2"/> Chargement...</div>;
    
    if (showStatement) return <ClientStatement clientId={clientId} onClose={() => setShowStatement(false)} silo="legal" />;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-100 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 relative">
                
                {/* HEADER - LEGAL BLUE THEME */}
                <div className="bg-white p-6 border-b border-slate-200 flex justify-between items-start shrink-0">
                    <div className="flex gap-4">
                        <div className="w-16 h-16 bg-blue-900 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-200">
                            <Building2 size={32}/>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">{profile?.name}</h1>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                {profile?.phone && <span className="flex items-center gap-1"><Phone size={14}/> {profile.phone}</span>}
                                {profile?.ice && <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs font-mono border border-slate-200">ICE: {profile.ice}</span>}
                                <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Client Légal (Silo A)</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full"><X size={24}/></button>
                </div>

                {/* STATS - LEGAL CONTEXT */}
                <div className="grid grid-cols-3 gap-px bg-slate-200 border-b border-slate-200 shrink-0">
                    <div className="bg-blue-50/50 p-6 flex flex-col justify-between group relative overflow-hidden col-span-2">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1"><Building2 size={12}/> Dette Fiscale (Factures Non Payées)</p>
                                <p className={`text-4xl font-black mt-2 ${stats?.currentDebt > 0 ? 'text-orange-600' : 'text-blue-900'}`}>{formatMAD(stats?.currentDebt || 0)}</p>
                                {stats?.availableCredit > 0 && <p className="text-xs text-emerald-600 font-bold mt-1">Dont Avoir Disponible: {formatMAD(stats.availableCredit)}</p>}
                            </div>
                            
                            {/* ✅ GROUPED ACTION BUTTONS */}
                            <div className="flex flex-col gap-2">
                                <button onClick={handleOpenLegalCollection} disabled={!isGlobalDebtPayable} className={`px-4 py-2 rounded-xl transition-colors font-bold flex items-center justify-center gap-2 ${isGlobalDebtPayable ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                                    <Banknote size={20}/>
                                    {isGlobalDebtPayable ? 'ENCAISSER' : 'À JOUR'}
                                </button>
                                
                                <button onClick={() => setShowLegacyDebtModal(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-200 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2">
                                    <History size={14}/> Importer Créance
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-4 flex flex-col justify-between">
                         <div className="mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Volume Facturé Légal</p>
                            <p className="text-xl font-black text-slate-800">{formatMAD(stats?.totalVolume || 0)}</p>
                         </div>
                         <button onClick={() => setShowStatement(true)} className="w-full py-3 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold uppercase text-xs gap-2 transition-all"><Printer size={16}/> Relevé de Compte</button>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="bg-slate-50 p-3 border-b border-slate-200 flex gap-2 shrink-0">
                    <select className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold outline-none text-slate-700" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="">Tous les documents légaux</option>
                        <option value="SALE_CASH">Factures</option>
                        <option value="RETURN">Avoirs</option>
                        <option value="QUOTE">Devis</option>
                    </select>
                </div>

                {/* HISTORY LIST */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 custom-scrollbar">
                      {history.map((m, idx) => {
                        const paid = Number(m.paid || 0);
                        const total = Number(m.amount || 0);
                        const remaining = Math.max(0, total - paid); // Prevents negative drift on UI
                        
                        // 🛡️ We now rely entirely on the Backend Status string!
                        const fullyPaid = isPaid(m.status);
                        const partialPaid = isPartial(m.status);
                        const cancelled = isCancelled(m.status);

                        return (
                            <div key={`${m.id}-${idx}`} className={`bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all border-blue-100 hover:border-blue-300`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${m.type === 'QUOTE' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-700'}`}>
                                        <FileText size={20}/>
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            {m.productName || 'Facture'}
                                            
                                            {/* 🏷️ STATUS LABELS (Now mathematically locked to backend state) */}
                                            {m.type === 'SALE_CASH' && !fullyPaid && !cancelled && (
                                                partialPaid ? (
                                                    <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 rounded border border-sky-200 font-bold uppercase flex items-center gap-1" title={`Reste: ${formatMAD(remaining)}`}><PieChart size={8}/> Partiel ({formatMAD(remaining)})</span>
                                                ) : (
                                                    <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 rounded border border-orange-200 font-bold uppercase flex items-center gap-1"><ShieldAlert size={8}/> Impayé</span>
                                                )
                                            )}

                                            {cancelled && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 rounded border border-red-200 font-bold uppercase flex items-center gap-1"><Ban size={8}/> Annulé</span>}
                                            
                                            {m.type === 'SALE_CASH' && fullyPaid && !cancelled && (
                                                <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1.5 rounded border border-emerald-200 font-bold uppercase flex items-center gap-1"><CheckCircle2 size={8}/> Payé</span>
                                            )}
                                        </div>

                                        <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                            <span>{new Date(m.date).toLocaleDateString('fr-MA')}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="font-bold text-blue-600 truncate max-w-[150px]">{m.paymentMethod}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                    <div className={`font-black ${cancelled ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                        {m.type === 'RETURN' ? '-' : ''}{formatMAD(total)}
                                    </div>
                                    
                                    {/* 💳 Show Payment Button ONLY if it's an unpaid/partial invoice */}
                                    {m.type === 'SALE_CASH' && !fullyPaid && !cancelled ? (
                                        <button onClick={() => setSelectedLegalInvoice(m)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all hover:scale-105">
                                            <Banknote size={14}/> {partialPaid ? 'SOLDE' : 'PAYER'}
                                        </button>
                                    ) : (
                                        <div className="w-8"></div>
                                    )}

                                    <button onClick={(e) => { e.stopPropagation(); handlePrintLegal(m); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-transparent hover:border-blue-200">
                                        <Printer size={18}/>
                                    </button>
                                </div>
                            </div>
                        );
                      })}
                      
                      {page < totalPages && (
                          <button onClick={() => loadHistory(page + 1)} disabled={loadingMore} className="w-full py-3 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-colors flex justify-center items-center gap-2">
                              {loadingMore ? <Loader2 className="animate-spin" size={18}/> : <><ChevronDown size={18}/> Charger plus</>}
                          </button>
                      )}
                      
                      {history.length === 0 && !loading && (
                          <div className="text-center py-10 opacity-50">
                              <Building2 size={48} className="mx-auto mb-2 text-slate-300"/>
                              <p className="text-sm font-bold text-slate-400">Aucun document légal trouvé</p>
                          </div>
                      )}
                </div>

                {/* MODALS */}
                {selectedLegalInvoice && <LegalPaymentModal invoice={selectedLegalInvoice} onClose={() => setSelectedLegalInvoice(null)} onSuccess={() => { loadProfile(); loadHistory(1, true); }} />}
                {printData && <InvoicePrint invoice={printData} onClose={() => setPrintData(null)} />}
                
                {/* 🆕 LEGACY DEBT MODAL */}
                {showLegacyDebtModal && (
                    <LegalLegacyDebtModal 
                        clientId={clientId} 
                        clientName={profile?.name || ''}
                        onClose={() => setShowLegacyDebtModal(false)} 
                        onSuccess={() => { setShowLegacyDebtModal(false); loadProfile(); loadHistory(1, true); }} 
                    />
                )}
            </div>
        </div>
    );
};