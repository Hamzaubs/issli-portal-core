import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, Search, User, ShoppingCart, 
    FileText, ArrowRight, ChevronRight, Calculator, UserPlus, Trash2
} from 'lucide-react';
import client from '../api/client';
import { QuotePrinter } from './QuotePrinter'; // ✅ Import Printer

interface Props {
    onCancel: () => void;
    onSuccess: () => void;
}

// Helper: Debounce
function debounce(func: Function, wait: number) {
    let timeout: any;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// 🛡️ SAFE MATH UTILS
const safeFloat = (val: any) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

const formatMoney = (val: number) => 
    val.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const InternalQuoteWizard: React.FC<Props> = ({ onCancel, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // Data Sources
    const [clients, setClients] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    
    // Search States
    const [clientSearch, setClientSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');

    // Selection
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);

    // New Client Form
    const [showClientForm, setShowClientForm] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: '', phone: '' });

    // ✅ PRINT STATE
    const [showPrintPreview, setShowPrintPreview] = useState(false);

    // 1️⃣ CLIENT SEARCH
    const searchClients = async (q: string) => {
        setLoading(true);
        try {
            const res = await client.get(`/internal/clients?q=${q}&limit=10`);
            setClients(res.data.data || []);
        } catch (err) {
            console.error("Client Search Error", err);
        } finally {
            setLoading(false);
        }
    };

    const debouncedClientSearch = useCallback(debounce((q: string) => searchClients(q), 300), []);

    useEffect(() => { debouncedClientSearch(clientSearch); }, [clientSearch]);

    // 2️⃣ PRODUCT SEARCH
    useEffect(() => {
        client.get('/internal/products').then(res => setProducts(res.data)).catch(console.error);
    }, []);

    // --- CART LOGIC ---
    const addToCart = (product: any) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...product, quantity: 1, unitPrice: safeFloat(product.sellingPrice) }]);
        }
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
            return item;
        }));
    };

    const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));
    const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // --- CREATE CLIENT ---
    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newClientData.name) return;
        setLoading(true);
        try {
            const res = await client.post('/internal/clients', newClientData);
            setSelectedClient(res.data);
            setStep(2);
        } catch (e: any) {
            alert("Erreur: " + e.response?.data?.error);
        } finally {
            setLoading(false);
        }
    };

    // --- SUBMISSION ---
    const handleSubmit = async () => {
        if (!selectedClient) return alert("Veuillez sélectionner un client.");
        if (cart.length === 0) return alert("Le panier est vide.");

        setLoading(true);
        try {
            await client.post('/internal/transactions/batch', {
                type: 'QUOTE',
                clientId: selectedClient.id,
                items: cart.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice
                }))
            });
            // ✅ SUCCESS: Instead of closing, show print preview
            setShowPrintPreview(true); 
        } catch (error: any) {
            alert("Erreur: " + (error.response?.data?.error || "Erreur inconnue"));
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

    // ✅ PRINT PREVIEW MODE (Replaces Wizard Content)
    if (showPrintPreview) {
        return (
            <QuotePrinter 
                items={cart.map(item => ({
                    product: { name: item.name, internalSku: item.internalSku, measureUnit: item.measureUnit },
                    qty: item.quantity,
                    unitPrice: item.unitPrice
                }))}
                clientName={selectedClient?.name}
                onClose={onSuccess} // Closing printer finishes the wizard
                onConfirm={undefined} // Already saved
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
            <div className="bg-slate-50 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10">
                
                {/* HEADER */}
                <div className="px-6 py-4 bg-white border-b border-amber-100 flex justify-between items-center shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                            <FileText size={24} strokeWidth={2.5}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 leading-tight flex items-center gap-2">
                                NOUVEAU DEVIS <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 uppercase tracking-wide">Stock B</span>
                            </h2>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mt-1">
                                <span className={step === 1 ? `text-amber-600 font-bold` : ''}>1. Client</span>
                                <ArrowRight size={10}/>
                                <span className={step === 2 ? `text-amber-600 font-bold` : ''}>2. Articles</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                        <X size={24}/>
                    </button>
                </div>

                {/* STEP 1: CLIENT SELECTION */}
                {step === 1 && (
                    <div className="flex-1 overflow-hidden flex flex-col p-8 bg-slate-50">
                        {!showClientForm ? (
                            <div className="max-w-2xl mx-auto w-full flex flex-col h-full">
                                <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">Qui est le client ?</h3>
                                <div className="relative mb-4 shrink-0">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                                    <input autoFocus type="text" placeholder="Rechercher (Nom, Téléphone)..." 
                                        className="w-full pl-12 p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all font-bold text-lg"
                                        value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {loading ? <div className="text-center py-10 text-slate-400">Recherche...</div> : 
                                     clients.length > 0 ? clients.map(c => (
                                        <button key={c.id} onClick={() => { setSelectedClient(c); setStep(2); }} 
                                            className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 hover:shadow-md transition-all text-left group">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 group-hover:bg-amber-200 group-hover:text-amber-800"><User size={20}/></div>
                                            <div className="flex-1"><div className="font-bold text-slate-800 text-lg">{c.name}</div><div className="text-xs text-slate-400 font-mono">{c.phone || 'Pas de téléphone'}</div></div>
                                            <ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500"/>
                                        </button>
                                    )) : (
                                        <div className="text-center py-10">
                                            <p className="text-slate-400 mb-4">Aucun client trouvé.</p>
                                            <button onClick={() => setShowClientForm(true)} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 shadow-lg flex items-center gap-2 mx-auto"><UserPlus size={18}/> Créer Nouveau Client</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-md mx-auto w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                                <h3 className="text-xl font-black text-slate-800 mb-6">Nouveau Client Rapide</h3>
                                <form onSubmit={handleCreateClient} className="space-y-4">
                                    <div><label className="text-xs font-bold text-slate-500 uppercase">Nom Complet *</label><input required autoFocus type="text" className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-amber-500 font-bold" value={newClientData.name} onChange={e => setNewClientData({...newClientData, name: e.target.value})} /></div>
                                    <div><label className="text-xs font-bold text-slate-500 uppercase">Téléphone</label><input type="text" className="w-full p-3 border-2 border-slate-200 rounded-xl outline-none focus:border-amber-500 font-medium" value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: e.target.value})} /></div>
                                    <div className="flex gap-3 pt-4">
                                        <button type="button" onClick={() => setShowClientForm(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Annuler</button>
                                        <button disabled={loading} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg">{loading ? '...' : 'Créer & Continuer'}</button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: CART BUILDING */}
                {step === 2 && (
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        <div className="w-full md:w-[65%] p-6 flex flex-col border-r border-slate-200 bg-white">
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input autoFocus type="text" placeholder="Chercher un produit..." className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-bold" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                            </div>
                            <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-3 pr-2 custom-scrollbar content-start">
                                {filteredProducts.map(p => (
                                    <button key={p.id} onClick={() => addToCart(p)} className="flex flex-col p-3 border border-slate-100 rounded-xl hover:border-amber-400 hover:shadow-md transition-all text-left bg-slate-50 hover:bg-white group h-[100px] justify-between">
                                        <div className="font-bold text-slate-700 text-sm line-clamp-2 leading-tight group-hover:text-amber-800">{p.name}</div>
                                        <div className="flex justify-between items-end mt-2">
                                            <div className="text-[10px] text-slate-400 font-medium bg-white px-1.5 py-0.5 rounded border border-slate-200">Stock: {p.quantity}</div>
                                            <div className="font-mono font-bold text-amber-600">{formatMoney(p.sellingPrice)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:w-[35%] bg-slate-50 flex flex-col border-l border-white shadow-2xl relative z-10">
                            <div className="p-4 bg-amber-100 border-b border-amber-200 flex justify-between items-center">
                                <div className="flex items-center gap-2 text-amber-900 font-bold"><User size={18}/> {selectedClient.name}</div>
                                <button onClick={() => setStep(1)} className="text-xs text-amber-700 hover:underline">Changer</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60"><ShoppingCart size={48} strokeWidth={1} className="mb-2"/><p>Le panier est vide</p></div> : 
                                 cart.map(item => (
                                    <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div className="font-bold text-slate-700 text-sm leading-tight">{item.name}</div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-white border rounded text-xs font-bold hover:bg-slate-100">-</button>
                                                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-white border rounded text-xs font-bold hover:bg-slate-100">+</button>
                                            </div>
                                            <div className="font-mono font-bold text-slate-700">{formatMoney(item.unitPrice * item.quantity)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                                <div className="flex justify-between items-center mb-4"><span className="text-sm font-bold text-slate-500 uppercase">Total Estimé</span><span className="text-2xl font-black text-amber-600">{formatMoney(totalAmount)} <span className="text-sm text-slate-400">MAD</span></span></div>
                                <button onClick={handleSubmit} disabled={loading || cart.length === 0} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                    {loading ? 'Enregistrement...' : <>ENREGISTRER & IMPRIMER <Calculator size={18}/></>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};