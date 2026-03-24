// web-ui/src/components/LegalPaymentModal.tsx
import React, { useState } from 'react';
import { X, Banknote, CheckCircle2, AlertTriangle, ShieldCheck, Loader2, Ban } from 'lucide-react';
import client from '../api/client';

interface LegalPaymentModalProps {
    invoice: any; 
    onClose: () => void;
    onSuccess: () => void;
}

export const LegalPaymentModal: React.FC<LegalPaymentModalProps> = ({ invoice, onClose, onSuccess }) => {
    // 🛡️ SAFETY CHECK: Status Validity
    const isCancelled = invoice.status === 'ANNULEE' || invoice.status === 'CANCELLED';
    const totalTTC = invoice.amount ? Number(invoice.amount) : 0;
    const paidAlready = invoice.paid ? Number(invoice.paid) : 0;
    const remaining = Number((totalTTC - paidAlready).toFixed(2));

    const [amount, setAmount] = useState<string>(remaining.toString());
    const [method, setMethod] = useState('VIREMENT');
    const [ref, setRef] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (isCancelled) {
            setError("Cette facture est annulée. Paiement impossible.");
            return;
        }

        setLoading(true);
        const amountNum = parseFloat(amount);

        // Frontend Safety Check
        if (amountNum > remaining + 0.05) {
            setError(`Montant trop élevé. Max: ${remaining} DH`);
            setLoading(false);
            return;
        }

        try {
            // ✅ FIX: URL now matches backend 'legal.ts' (needs ID in path)
            await client.post(`/legal/invoices/${invoice.id}/payment`, {
                amount: amountNum,
                method,
                reference: ref,
                note: note || 'Règlement via Profil Client'
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || "Echec du paiement");
        } finally {
            setLoading(false);
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    // 🛑 BLOCK RENDER IF CANCELLED
    if (isCancelled) {
        return (
             <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Ban size={32}/>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Facture Annulée</h3>
                    <p className="text-slate-500 mb-6">Impossible d'encaisser un paiement sur ce document car il a été annulé fiscalement.</p>
                    <button onClick={onClose} className="w-full py-3 bg-slate-200 hover:bg-slate-300 font-bold rounded-xl">Fermer</button>
                </div>
             </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-blue-100">
                <div className="bg-blue-900 p-6 text-white flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <ShieldCheck className="text-blue-300"/> Encaissement Légal
                        </h3>
                        <p className="text-xs text-blue-200 opacity-80">Facture #{invoice.productName?.replace('Facture #', '') || '???'}</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-blue-800 p-2 rounded-full transition-colors relative z-10"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                        <p className="text-xs text-blue-500 uppercase font-bold tracking-wider mb-1">Reste à payer (Officiel)</p>
                        <p className="text-3xl font-black text-blue-900">{formatMAD(remaining)}</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2">
                            <AlertTriangle size={16}/> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Montant à Encaisser</label>
                        <input 
                            type="number" step="0.01" autoFocus
                            className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-xl text-blue-900 outline-none focus:border-blue-500 transition-colors"
                            value={amount}
                            onChange={e => { setAmount(e.target.value); setError(''); }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mode</label>
                            <select className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500" value={method} onChange={e => setMethod(e.target.value)}>
                                <option value="VIREMENT">Virement</option>
                                <option value="CHEQUE">Chèque</option>
                                <option value="ESPECES">Espèces</option>
                                <option value="EFFET">Effet</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Référence</label>
                            <input type="text" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500" placeholder="N° Chèque/Vir" value={ref} onChange={e => setRef(e.target.value)} />
                        </div>
                    </div>

                    <button type="submit" disabled={loading || parseFloat(amount) <= 0} className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? <Loader2 className="animate-spin"/> : <CheckCircle2 size={20}/>}
                        {loading ? 'Traitement...' : 'Valider le Paiement'}
                    </button>
                </form>
            </div>
        </div>
    );
};