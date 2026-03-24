import React, { useState } from 'react';
import { X, Banknote, CheckCircle2 } from 'lucide-react';
import client from '../api/client';

interface PaymentModalProps {
    invoice: any;
    onClose: () => void;
    onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, onClose, onSuccess }) => {
    const [amount, setAmount] = useState<number>(invoice.totalTTC - (invoice.amountPaid || 0));
    const [method, setMethod] = useState('ESPECES');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Call the Controller we just fixed
            await client.post(`/legal/invoices/${invoice.id}/payment`, {
                amount: Number(amount),
                method,
                note
            });
            onSuccess(); // Triggers Dashboard Refresh
        } catch (error: any) {
            alert("Erreur: " + (error.response?.data?.error || "Echec du paiement"));
        } finally {
            setLoading(false);
        }
    };

    const remaining = invoice.totalTTC - (invoice.amountPaid || 0);

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Banknote className="text-emerald-400"/> Encaisser Paiement
                    </h3>
                    <button onClick={onClose} className="hover:bg-slate-700 p-2 rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Reste à payer</p>
                        <p className="text-3xl font-black text-slate-800">
                            {new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(remaining)}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Montant Reçu</label>
                        <input 
                            type="number" step="0.01" 
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500"
                            value={amount}
                            max={remaining}
                            onChange={e => setAmount(parseFloat(e.target.value))}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Mode de Paiement</label>
                        <select 
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none"
                            value={method}
                            onChange={e => setMethod(e.target.value)}
                        >
                            <option value="ESPECES">Espèces</option>
                            <option value="CHEQUE">Chèque</option>
                            <option value="VIREMENT">Virement Bancaire</option>
                            <option value="CARTE">Carte Bancaire</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Note / Référence</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none"
                            placeholder="Ex: Numéro de chèque..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || amount <= 0}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Traitement...' : <><CheckCircle2 size={20}/> Valider l'Encaissement</>}
                    </button>
                </form>
            </div>
        </div>
    );
};