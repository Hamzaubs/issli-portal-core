// web-ui/src/components/InternalLegacyDebtModal.tsx
import React, { useState } from 'react';
import { X, History, Save, AlertTriangle } from 'lucide-react';
import client from '../api/client';

interface Props {
    clientId: string;
    clientName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const InternalLegacyDebtModal: React.FC<Props> = ({ clientId, clientName, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    
    // Default date to yesterday
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 1);
    
    const [date, setDate] = useState(defaultDate.toISOString().split('T')[0]);
    const [amount, setAmount] = useState<number | string>('');
    const [legacyRef, setLegacyRef] = useState('');
    const [note, setNote] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = Number(amount) || 0;
        if (numAmount <= 0) return alert("Le montant doit être supérieur à 0.");

        setLoading(true);
        try {
            await client.post(`/internal/clients/${clientId}/legacy-debt`, {
                amount: numAmount,
                issuedAt: new Date(date).toISOString(),
                legacyRef: legacyRef || 'DETTE-ANCIENNE',
                note: note.trim()
            });
            alert("✅ Dette ancienne (Silo B) importée avec succès.");
            onSuccess();
        } catch (err: any) {
            alert("Erreur: " + (err.response?.data?.error || "Erreur serveur"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                            <History size={24}/>
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-lg">Importer Ancienne Créance</h3>
                            <p className="text-xs font-bold text-slate-500">Client: {clientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="bg-amber-50 border-b border-amber-100 p-4 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                    <p>
                        <strong>Note :</strong> Ceci ajoutera directement la dette au compte du client <strong>sans modifier le stock</strong>. Antidatez la transaction pour ne pas fausser la caisse du jour.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date d'origine</label>
                            <input type="date" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" 
                                value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Réf / Carnet</label>
                            <input type="text" placeholder="Ex: Page 42" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-emerald-500" 
                                value={legacyRef} onChange={e => setLegacyRef(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                            Montant Dû <span className="text-emerald-600">MAD</span>
                        </label>
                        <input type="number" step="0.01" required autoFocus className="w-full p-3 bg-white border-2 border-emerald-200 rounded-xl font-black text-xl text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" 
                            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Détails (Optionnel)</label>
                        <input type="text" placeholder="Ex: Reste à payer 2025..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500" 
                            value={note} onChange={e => setNote(e.target.value)} />
                    </div>

                    <button disabled={loading} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4">
                        {loading ? 'Création...' : <><Save size={20}/> ENREGISTRER LA DETTE</>}
                    </button>
                </form>
            </div>
        </div>
    );
};