import React, { useState, useEffect } from 'react';
import { 
    X, Save, ArrowUpCircle, ArrowDownCircle, RotateCcw, 
    Plus, Trash2, ShoppingCart, Package, Printer, User, CreditCard, Calculator 
} from 'lucide-react';
import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export const TransactionForm: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [type, setType] = useState<'SALE_CASH' | 'RESTOCK' | 'RETURN'>('SALE_CASH');
    const [products, setProducts] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    
    // Selection State
    const [productId, setProductId] = useState('');
    const [clientId, setClientId] = useState('');
    const [quantity, setQuantity] = useState(1);
    
    // 🛒 Cart State (Now upgraded for Master Reality TVA Math)
    const [cart, setCart] = useState<any[]>([]);
    
    // Global Payment State
    const [paymentMethod, setPaymentMethod] = useState('CASH'); 
    const [paymentRef, setPaymentRef] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [printData, setPrintData] = useState<any>(null);

    const getUnitLabel = (unit?: string) => { 
        switch(unit) { 
            case 'M': return 'm'; 
            case 'KG': return 'kg'; 
            case 'L': return 'L'; 
            default: return 'u'; 
        } 
    };

    useEffect(() => {
        const load = async () => {
            try {
                const [p, c] = await Promise.all([
                    client.get('/internal/products'),
                    client.get('/internal/clients')
                ]);
                setProducts(p.data);
                setClients(c.data.data || c.data || []); 
            } catch (err) { console.error(err); }
        };
        load();
    }, []);

    // ========================================================================
    // 🧮 ADD TO CART: CENT-BASED MATH ENGINE
    // ========================================================================
    const addToCart = () => {
        if (!productId) return;
        const product = products.find(p => p.id === productId);
        if (!product) return;

        // Safety Check
        if (type === 'SALE_CASH' && product.quantity < quantity) {
            alert(`Stock insuffisant pour ${product.name}. Disponible: ${product.quantity}`);
            return;
        }

        const qty = Number(quantity);
        // Execute math based on exact database values to prevent UI drift
        const itemTotalHT = product.priceHT * qty;
        const itemTotalTTC = product.priceTTC * qty;
        const itemTotalTVA = itemTotalTTC - itemTotalHT;

        const newItem = {
            productId: product.id,
            name: product.name,
            internalSku: product.internalSku,
            quantity: qty,
            measureUnit: product.measureUnit,
            priceHT: product.priceHT,
            vatRate: product.vatRate,
            priceTTC: product.priceTTC,
            totalHT: itemTotalHT,
            totalTVA: itemTotalTVA,
            totalTTC: itemTotalTTC
        };

        setCart([...cart, newItem]);
        setProductId('');
        setQuantity(1);
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    // 📊 Dynamic Cart Aggregations
    const cartTotalHT = cart.reduce((sum, item) => sum + item.totalHT, 0);
    const cartTotalTVA = cart.reduce((sum, item) => sum + item.totalTVA, 0);
    const cartTotalTTC = cart.reduce((sum, item) => sum + item.totalTTC, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) return alert("Le panier est vide.");

        setLoading(true);
        try {
            // 🚀 The API Payload strictly sends unitPriceHT to lock the backend math
            const res = await client.post('/internal/transactions/batch', {
                type,
                clientId: (type === 'SALE_CASH' || type === 'RETURN') ? clientId : undefined,
                items: cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPriceHT: item.priceHT // Forces backend to use snapshot price at time of sale
                })),
                paymentMethod: type === 'SALE_CASH' ? paymentMethod : undefined,
                paymentRef: (paymentMethod === 'CHECK' || paymentMethod === 'TRANSFER') ? paymentRef : undefined
            });
            
            const selectedClient = clients.find(c => c.id === clientId);
            
            // Trigger Auto-Print (Legacy Mapping to preserve InternalDeliveryNote.tsx logic)
            setPrintData({
                id: res.data.ticketId,
                date: new Date(),
                clientName: selectedClient?.name || 'CLIENT COMPTOIR',
                items: cart.map(item => ({
                    productName: item.name,
                    sku: item.internalSku,
                    quantity: item.quantity,
                    measureUnit: item.measureUnit,
                    unitPrice: item.priceTTC, // Mapped TTC for the physical receipt
                    total: item.totalTTC
                })),
                total: cartTotalTTC,
                isQuote: false,
                isReturn: type === 'RETURN',
                paymentMethod: type === 'SALE_CASH' ? paymentMethod : 'N/A',
                paymentRef: paymentRef
            });
        } catch (error: any) {
            alert("Erreur: " + (error.response?.data?.error || error.message));
            setLoading(false);
        }
    };

    if (printData) {
        return <InternalDeliveryNote data={printData} onClose={() => { setPrintData(null); onSuccess(); onClose(); }} />;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                
                {/* HEADER */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-900 text-white p-2 rounded-lg"><Package size={20}/></div>
                        <h2 className="text-xl font-black text-slate-800">Caisse & Mouvements (Stock B)</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="text-slate-400"/></button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    
                    {/* LEFT: PICKER */}
                    <div className="w-full md:w-1/2 p-6 border-r border-slate-100 overflow-y-auto">
                        <div className="space-y-6">
                            <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => setType('SALE_CASH')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 font-bold text-[10px] transition-all ${type === 'SALE_CASH' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <ArrowUpCircle size={20}/> VENTE
                                </button>
                                <button type="button" onClick={() => setType('RESTOCK')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 font-bold text-[10px] transition-all ${type === 'RESTOCK' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <ArrowDownCircle size={20}/> ARRIVAGE
                                </button>
                                <button type="button" onClick={() => setType('RETURN')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 font-bold text-[10px] transition-all ${type === 'RETURN' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    <RotateCcw size={20}/> RETOUR
                                </button>
                            </div>

                            {(type === 'SALE_CASH' || type === 'RETURN') && (
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-blue-600 uppercase mb-2 flex items-center gap-2"><User size={12}/> Client</label>
                                        <select className="w-full p-2.5 bg-white border border-blue-200 rounded-lg font-bold"
                                            value={clientId} onChange={e => setClientId(e.target.value)}>
                                            <option value="">-- Client Comptoir --</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {type === 'SALE_CASH' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 flex items-center gap-1"><CreditCard size={10}/> Paiement</label>
                                                <select className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                                                    value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setPaymentRef(''); }}>
                                                    <option value="CASH">Espèces</option>
                                                    <option value="CREDIT">Crédit</option>
                                                    <option value="CHECK">Chèque</option>
                                                    <option value="TRANSFER">Virement</option>
                                                </select>
                                            </div>
                                            {(paymentMethod === 'CHECK' || paymentMethod === 'TRANSFER') && (
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-500 uppercase mb-1">N° Réf</label>
                                                    <input type="text" required className="w-full p-2 bg-white border border-blue-300 rounded-lg text-xs font-mono"
                                                        value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Produit</label>
                                    <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                        value={productId} onChange={e => setProductId(e.target.value)}>
                                        <option value="">-- Sélectionner --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.priceTTC.toFixed(2)} DH | Stock: {p.quantity})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantité</label>
                                        <input type="number" min="1" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                                            value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                                    </div>
                                    <button type="button" onClick={addToCart} disabled={!productId} className="self-end px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-30 flex items-center gap-2">
                                        <Plus size={18}/> Ajouter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: CART SUMMARY */}
                    <div className="w-full md:w-1/2 bg-slate-50 p-6 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h3 className="font-bold text-slate-600 flex items-center gap-2"><ShoppingCart size={18}/> Articles ({cart.length})</h3>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2 custom-scrollbar">
                            {cart.map((item, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center animate-in slide-in-from-right-5 shadow-sm">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {item.quantity} {getUnitLabel(item.measureUnit)} × {item.priceTTC.toFixed(2)} MAD (TTC)
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-black text-slate-900 text-sm">{item.totalTTC.toFixed(2)} DH</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">HT: {item.totalHT.toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 🧮 MASTER ANALYTICS TOTALS BOX */}
                        <div className="bg-slate-900 rounded-2xl p-6 text-white shrink-0 shadow-xl">
                            <div className="space-y-1 mb-3">
                                <div className="flex justify-between items-center text-sm text-slate-400">
                                    <p>Total HT</p>
                                    <p className="font-mono">{cartTotalHT.toFixed(2)} MAD</p>
                                </div>
                                <div className="flex justify-between items-center text-sm text-slate-400">
                                    <p>TVA Calculée</p>
                                    <p className="font-mono">{cartTotalTVA.toFixed(2)} MAD</p>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-end pt-3 border-t border-slate-700 mb-4">
                                <p className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1">
                                    <Calculator size={12}/> NET À PAYER (TTC)
                                </p>
                                <p className="text-3xl font-black text-white">{cartTotalTTC.toFixed(2)} <span className="text-sm text-slate-400">MAD</span></p>
                            </div>
                            
                            <button onClick={handleSubmit} disabled={loading || cart.length === 0} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95">
                                {loading ? 'Envoi...' : <><Printer size={20}/> VALIDER ET IMPRIMER</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};