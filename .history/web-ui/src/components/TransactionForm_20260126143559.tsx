import React, { useState, useEffect } from 'react';
import { X, Save, ArrowUpCircle, ArrowDownCircle, RotateCcw } from 'lucide-react';
import client from '../api/client';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export const TransactionForm: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [type, setType] = useState<'SALE_CASH' | 'RESTOCK' | 'RETURN'>('SALE_CASH');
    const [products, setProducts] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    
    // Form State
    const [productId, setProductId] = useState('');
    const [clientId, setClientId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH', 'CREDIT', 'CHECK'
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Load Data
        const load = async () => {
            const [p, c] = await Promise.all([
                client.get('/dashboard/products'),
                // Ideally create a specific /clients endpoint, but for now we might fetch from history or similar
                // If you don't have a /clients endpoint, we can temporarily assume clients are loaded or use a simple fetch
                // For this example, I'll assume you might need to add a simple route or use what you have.
                // Let's assume we fetch clients via a new helper or existing route. 
                // If not available, we'll fetch from invoices to get the list (as done in InvoiceWizard).
                client.get('/legal/invoices').then(res => { 
                    const unique = new Map();
                    res.data.forEach((i:any) => i.client && unique.set(i.client.id, i.client));
                    return Array.from(unique.values());
                }) 
            ]);
            setProducts(p.data);
            setClients(c);
        };
        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await client.post('/dashboard/transactions', {
                type,
                productId,
                quantity: Number(quantity),
                clientId: (type === 'SALE_CASH' || type === 'RETURN') ? clientId : undefined,
                paymentMethod: type === 'SALE_CASH' ? paymentMethod : undefined
            });
            alert("Transaction enregistrée !");
            onSuccess();
        } catch (error: any) {
            alert("Erreur: " + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const selectedProduct = products.find(p => p.id === productId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-slate-800">Nouvelle Transaction</h2>
                    <button onClick={onClose}><X className="text-slate-400 hover:text-slate-700"/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    
                    {/* TYPE SELECTION */}
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setType('SALE_CASH')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 font-bold text-xs transition-all ${type === 'SALE_CASH' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                            <ArrowUpCircle size={20}/> VENTE / SORTIE
                        </button>
                        <button type="button" onClick={() => setType('RESTOCK')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 font-bold text-xs transition-all ${type === 'RESTOCK' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}>
                            <ArrowDownCircle size={20}/> ENTRÉE / STOCK
                        </button>
                        <button type="button" onClick={() => setType('RETURN')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 font-bold text-xs transition-all ${type === 'RETURN' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>
                            <RotateCcw size={20}/> RETOUR CLIENT
                        </button>
                    </div>

                    {/* PRODUCT */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Produit</label>
                        <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            value={productId} onChange={e => setProductId(e.target.value)}>
                            <option value="">-- Sélectionner --</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>
                            ))}
                        </select>
                    </div>

                    {/* QUANTITY */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantité</label>
                        <input type="number" min="1" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                        />
                    </div>

                    {/* CLIENT & PAYMENT (Only for Sales/Returns) */}
                    {(type === 'SALE_CASH' || type === 'RETURN') && (
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Client</label>
                                <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={clientId} onChange={e => setClientId(e.target.value)}>
                                    <option value="">-- Sélectionner Client --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {type === 'SALE_CASH' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mode de Paiement</label>
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                        <option value="CASH">Espèces (Caisse)</option>
                                        <option value="CREDIT">⚠️ CRÉDIT (Dette Client)</option>
                                        <option value="CHECK">Chèque</option>
                                        <option value="TRANSFER">Virement</option>
                                    </select>
                                    {paymentMethod === 'CREDIT' && (
                                        <p className="text-xs text-red-500 font-bold mt-1">Note: Cela augmentera la dette du client.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <button disabled={loading} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all flex justify-center items-center gap-2">
                        {loading ? 'Traitement...' : <><Save size={18}/> Valider Transaction</>}
                    </button>
                </form>
            </div>
        </div>
    );
};