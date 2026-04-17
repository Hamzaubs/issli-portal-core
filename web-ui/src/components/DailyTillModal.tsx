// web-ui/src/components/DailyTillModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Calculator, Banknote, Printer, AlertTriangle, CheckCircle2, ShieldCheck, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import client from '../api/client';

interface Props {
    onClose: () => void;
}

export const DailyTillModal: React.FC<Props> = ({ onClose }) => {
    const currentUser = JSON.parse(localStorage.getItem('marine_user') || '{}');
    const printRef = useRef<HTMLDivElement>(null);
    
    const [loading, setLoading] = useState(true);
    const [countedCash, setCountedCash] = useState<string>('');
    const [stats, setStats] = useState({
        sales: 0,
        clientPayments: 0,
        supplierPayments: 0,
        returns: 0,
        refunds: 0,
        expectedTotal: 0
    });

    // 🛡️ TIMEZONE SAFE DATE
    const now = new Date();
    const localDateString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    useEffect(() => {
        const fetchTodaysCash = async () => {
            setLoading(true);
            try {
                const res = await client.get(`/internal/till?date=${localDateString}`);
                setStats(res.data);
            } catch (error) {
                console.error("Erreur clôture de caisse:", error);
                alert("Impossible de charger les transactions du jour.");
            } finally {
                setLoading(false);
            }
        };

        fetchTodaysCash();
    }, [localDateString]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Cloture_Caisse_${localDateString}`,
        bodyClass: "print-body"
    });

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    // 🧮 Safe calculation of the Cash Gap (Écart)
    const countedCents = Math.round(Number(countedCash || 0) * 100);
    const expectedCents = Math.round(stats.expectedTotal * 100);
    const gapCents = countedCents - expectedCents;
    const gap = gapCents / 100;

    return (
        <div className="fixed inset-0 z-[500] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <style>{`
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { font-family: monospace; color: black; background: white; -webkit-print-color-adjust: exact; }
                }
            `}</style>

            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="p-6 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                            <ShieldCheck size={24}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-black">Clôture de Caisse</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString('fr-MA')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 font-bold tracking-widest">
                            <Loader2 className="animate-spin mb-4" size={32}/>
                            CALCUL DES FONDS...
                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* SYSTEM CALCULATION */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Calculator size={14}/> Théorie Système (Espèces)</h3>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-bold text-slate-600">
                                        <span className="flex items-center gap-1.5"><ArrowUpRight size={14} className="text-emerald-500"/> Ventes Comptoir</span>
                                        <span className="text-emerald-600">+{formatMAD(stats.sales)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-600">
                                        <span className="flex items-center gap-1.5"><ArrowUpRight size={14} className="text-emerald-500"/> Règlements Clients</span>
                                        <span className="text-emerald-600">+{formatMAD(stats.clientPayments)}</span>
                                    </div>
                                    {stats.refunds > 0 && (
                                        <div className="flex justify-between text-sm font-bold text-slate-600">
                                            <span className="flex items-center gap-1.5"><ArrowUpRight size={14} className="text-emerald-500"/> Remboursements Fournisseurs</span>
                                            <span className="text-emerald-600">+{formatMAD(stats.refunds)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 pt-3 border-t border-slate-100">
                                    <div className="flex justify-between text-sm font-bold text-slate-600">
                                        <span className="flex items-center gap-1.5"><ArrowDownRight size={14} className="text-red-500"/> Retours Clients</span>
                                        <span className="text-red-500">-{formatMAD(stats.returns)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-600">
                                        <span className="flex items-center gap-1.5"><ArrowDownRight size={14} className="text-red-500"/> Dépenses Fournisseurs</span>
                                        <span className="text-red-500">-{formatMAD(stats.supplierPayments)}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-2">
                                    <span className="text-sm font-black uppercase text-slate-500">Caisse Attendue</span>
                                    <span className="text-2xl font-black text-slate-900">{formatMAD(stats.expectedTotal)}</span>
                                </div>
                            </div>

                            {/* PHYSICAL COUNT INPUT */}
                            <div className="bg-blue-50 border-2 border-blue-100 p-5 rounded-2xl">
                                <label className="block text-xs font-black text-blue-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Banknote size={16}/> Caisse Physique Comptée
                                </label>
                                <input 
                                    type="number" step="0.01" min="0" autoFocus
                                    placeholder="Entrez le montant en caisse..."
                                    className="w-full bg-white border-2 border-blue-200 rounded-xl p-4 text-center text-3xl font-black text-blue-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-inner"
                                    value={countedCash} 
                                    onChange={e => setCountedCash(e.target.value)}
                                />
                            </div>

                            {/* GAP ANALYSIS */}
                            {countedCash !== '' && (
                                <div className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${
                                    gap === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                    gap > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                                    'bg-red-50 border-red-200 text-red-700'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        {gap === 0 ? <CheckCircle2 size={24}/> : <AlertTriangle size={24}/>}
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest">Écart de Caisse</p>
                                            <p className="font-bold text-sm">
                                                {gap === 0 ? 'Caisse parfaite' : gap > 0 ? 'Excédent (Trop perçu)' : 'Déficit (Manquant)'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-black">{gap > 0 ? '+' : ''}{formatMAD(gap)}</span>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-200 bg-white flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Fermer</button>
                    <button 
                        onClick={() => handlePrint && handlePrint()} 
                        disabled={loading || countedCash === ''} 
                        className="flex-[2] py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Printer size={18}/> Imprimer Ticket Z
                    </button>
                </div>
            </div>

            {/* 🖨️ HIDDEN PRINTABLE RECEIPT (TICKET Z FORMAT 80mm) */}
            <div className="hidden">
                <div ref={printRef} className="w-[80mm] bg-white p-4 text-black text-sm">
                    <div className="text-center mb-4 border-b-2 border-black border-dashed pb-4">
                        <h1 className="text-xl font-black">PORTAIL ISSLI</h1>
                        <p className="font-bold uppercase mt-1">Clôture de Caisse (Z)</p>
                        <p className="text-xs mt-1">{new Date().toLocaleString('fr-MA')}</p>
                        <p className="text-xs mt-1">Terminal: MAGASIN (Stock Global)</p>
                        <p className="text-xs">Opérateur: {currentUser.username || 'Admin'}</p>
                    </div>

                    <div className="space-y-1 mb-4 border-b-2 border-black border-dashed pb-4 font-bold text-xs">
                        <p className="text-center bg-black text-white py-1 mb-2 uppercase">Entrées (+)</p>
                        <div className="flex justify-between"><span>Ventes Comptoir:</span><span>{formatMAD(stats.sales)}</span></div>
                        <div className="flex justify-between"><span>Règlements Clients:</span><span>{formatMAD(stats.clientPayments)}</span></div>
                        {stats.refunds > 0 && <div className="flex justify-between"><span>Remb. Fournisseurs:</span><span>{formatMAD(stats.refunds)}</span></div>}
                        
                        <p className="text-center bg-black text-white py-1 mt-3 mb-2 uppercase">Sorties (-)</p>
                        <div className="flex justify-between"><span>Retours Clients:</span><span>{formatMAD(stats.returns)}</span></div>
                        <div className="flex justify-between"><span>Dépenses Fournisseurs:</span><span>{formatMAD(stats.supplierPayments)}</span></div>
                    </div>

                    <div className="space-y-2 mb-6 font-black text-lg">
                        <div className="flex justify-between"><span>THÉORIE:</span><span>{formatMAD(stats.expectedTotal)}</span></div>
                        <div className="flex justify-between"><span>COMPTÉ:</span><span>{formatMAD(Number(countedCash || 0))}</span></div>
                    </div>

                    <div className="text-center border-t-2 border-b-2 border-black py-2 mb-8">
                        <p className="font-bold text-xs uppercase">Écart Constaté</p>
                        <p className="font-black text-xl">{gap > 0 ? '+' : ''}{formatMAD(gap)}</p>
                    </div>

                    <div className="text-center space-y-6">
                        <p className="text-xs font-bold uppercase">Signature Responsable</p>
                        <div className="h-12"></div>
                        <p className="text-[10px]">Document généré électroniquement.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};