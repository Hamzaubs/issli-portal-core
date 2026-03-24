// web-ui/src/components/LegalLegacyDebtModal.tsx
import React, { useState } from 'react';
import { X, History, Save, AlertTriangle, Calculator } from 'lucide-react';
import client from '../api/client';

interface Props {
    clientId: string;
    clientName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const LegalLegacyDebtModal: React.FC<Props> = ({ clientId, clientName, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    
    // Default date to yesterday or last year to imply it's old
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 1);
    
    const [date, setDate] = useState(defaultDate.toISOString().split('T')[0]);
    const [amountTTC, setAmountTTC] = useState<number | string>('');
    const [vatRate, setVatRate] = useState(0.20);
    const [legacyRef, setLegacyRef] = useState('');
    const [note, setNote] = useState('');

    // Reverse Calculate HT
    const numTTC = Number(amountTTC) || 0;
    const amountHT = numTTC / (1 + vatRate);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (numTTC <= 0) return alert("Le montant doit être supérieur à 0.");

        setLoading(true);
        try {
            await client.post('/legal/documents', {
                type: 'FACTURE',
                clientId: clientId,
                isCredit: true,
                initialPayment: 0, // It's a pure debt, nothing paid yet
                issuedAt: new Date(date).toISOString(),
                legacyReference: legacyRef || 'DETTE-ANCIENNE',
                note: `[REPRISE DE DETTE] ${note}`.trim(),
                items: [
                    {
                        productId: null, // 🛡️ Ghost Item: Doesn't touch stock!
                        productName: 'Reprise Ancienne Dette / Solde Antérieur',
                        quantity: 1,
                        unitPrice: amountHT, // Backend expects HT
                        vatRate: vatRate,
                        measureUnit: 'UNIT'
                    }
                ]
            });
            alert("✅ Dette ancienne importée avec succès.");
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
                            <h3 className="font-black text-slate-800 text-lg">Importer Ancienne Dette</h3>
                            <p className="text-xs font-bold text-slate-500">Client: {clientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="bg-amber-50 border-b border-amber-100 p-4 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
                    <p>
                        <strong>Attention :</strong> Cette opération génère une facture officielle de reprise de solde. 
                        <strong> Aucun produit ne sera déduit du stock.</strong> Antidatez la facture pour ne pas fausser le chiffre d'affaires d'aujourd'hui.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date d'origine de la dette</label>
                            <input type="date" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500" 
                                value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ancienne Réf (Optionnel)</label>
                            <input type="text" placeholder="Ex: Fac-2025-010" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-blue-500" 
                                value={legacyRef} onChange={e => setLegacyRef(e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                                Montant Dû (TTC) <span className="text-blue-600">MAD</span>
                            </label>
                            <input type="number" step="0.01" required autoFocus className="w-full p-3 bg-white border-2 border-blue-200 rounded-xl font-black text-xl text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-right" 
                                value={amountTTC} onChange={e => setAmountTTC(e.target.value)} placeholder="0.00" />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taux TVA Appliqué</label>
                            <div className="flex bg-slate-50 rounded-xl border border-slate-200 p-1">
                                <button type="button" onClick={() => setVatRate(0)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${vatRate === 0 ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>0%</button>
                                <button type="button" onClick={() => setVatRate(0.10)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${vatRate === 0.10 ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>10%</button>
                                <button type="button" onClick={() => setVatRate(0.20)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${vatRate === 0.20 ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}>20%</button>
                            </div>
                        </div>
                    </div>

                    {/* Automatic HT Calculator Display */}
                    <div className="bg-slate-100 p-3 rounded-lg flex justify-between items-center text-xs font-mono border border-slate-200">
                        <div className="flex items-center gap-2 text-slate-500"><Calculator size={14}/> Base HT calculée :</div>
                        <div className="font-bold text-slate-700">{amountHT.toFixed(2)} MAD</div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Détails / Motif</label>
                        <input type="text" placeholder="Ex: Report de solde non payé au 31/12/2025..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500" 
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