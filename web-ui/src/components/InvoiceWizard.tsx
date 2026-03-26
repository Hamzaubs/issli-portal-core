// web-ui/src/components/InvoiceWizard.tsx
import React, { useState, useEffect } from 'react';
import { 
    X, Search, Plus, Trash2, User, ShoppingCart, 
    Undo2, FileText, PackagePlus, ArrowRight, ChevronRight,
    Wallet, CreditCard, Banknote, Truck, Percent
} from 'lucide-react';
import client from '../api/client';

interface Props {
    mode: 'INVOICE' | 'QUOTE' | 'CREDIT_NOTE'; 
    onCancel: () => void;
    onSuccess: () => void;
}

// 🛡️ BIG DATA & MATH SAFETY UTILS
const safeFloat = (val: any): number => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

const formatMoney = (val: number): string => {
    return val.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ✅ Theme Configuration
const THEMES = {
    INVOICE: {
        color: 'blue',
        bgLight: 'bg-blue-50',
        bgSoft: 'bg-blue-100',
        textMain: 'text-blue-600',
        textDark: 'text-blue-700',
        border: 'border-blue-200',
        button: 'bg-blue-600 hover:bg-blue-700',
        icon: ShoppingCart,
        title: 'Nouvelle Vente'
    },
    QUOTE: {
        color: 'amber',
        bgLight: 'bg-amber-50',
        bgSoft: 'bg-amber-100',
        textMain: 'text-amber-600',
        textDark: 'text-amber-800', 
        border: 'border-amber-200',
        button: 'bg-amber-500 hover:bg-amber-600', 
        icon: FileText,
        title: 'Nouveau Devis'
    },
    CREDIT_NOTE: {
        color: 'orange',
        bgLight: 'bg-orange-50',
        bgSoft: 'bg-orange-100',
        textMain: 'text-orange-600',
        textDark: 'text-orange-700',
        border: 'border-orange-200',
        button: 'bg-orange-600 hover:bg-orange-700',
        icon: Undo2,
        title: 'Retour / Avoir'
    }
};

export const InvoiceWizard: React.FC<Props> = ({ mode, onCancel, onSuccess }) => {
    const theme = THEMES[mode];
    const [step, setStep] = useState(1);
    const [clients, setClients] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [cart, setCart] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState(''); 
    
    // Custom Item State
    const [showCustomItemForm, setShowCustomItemForm] = useState(false);
    const [customItemName, setCustomItemName] = useState('');
    const [customItemPrice, setCustomItemPrice] = useState('');
    const [customItemVat, setCustomItemVat] = useState('0.20');

    // Payment State (Invoices Only)
    const [paymentMode, setPaymentMode] = useState<'CASH' | 'CREDIT'>('CASH');
    const [paymentMethod, setPaymentMethod] = useState('ESPECES'); 
    const [paymentRef, setPaymentRef] = useState(''); 
    const [initialPayment, setInitialPayment] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const [c, p] = await Promise.all([
                    client.get('/legal/clients?limit=1000'), 
                    client.get('/legal/products')
                ]);
                
                setClients(Array.isArray(c.data) ? c.data : c.data?.data || []);
                setProducts(Array.isArray(p.data) ? p.data : p.data?.data || []);
                
            } catch (e) { 
                console.error("Error loading resources", e); 
            }
        };
        load();
    }, []);

    const addToCart = (product: any) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...product, quantity: 1, vatRate: safeFloat(product.vatRate) || 0.20 }]);
        }
    };

    const addCustomItem = () => {
        if (!customItemName || !customItemPrice) return;
        const newItem = {
            id: `TEMP_${Date.now()}`, 
            name: customItemName, 
            priceHT: safeFloat(customItemPrice),
            quantity: 1, 
            vatRate: safeFloat(customItemVat), 
            isCustom: true,
            measureUnit: 'UNIT' // Default for custom items
        };
        setCart([...cart, newItem]);
        setCustomItemName(''); setCustomItemPrice(''); setCustomItemVat('0.20'); setShowCustomItemForm(false);
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(cart.map(item => { if (item.id === id) return { ...item, quantity: Math.max(0.01, item.quantity + delta) }; return item; }));
    };

    const setQuantity = (id: string, val: number) => {
        setCart(cart.map(item => { if (item.id === id) return { ...item, quantity: val }; return item; }));
    };

    const removeFromCart = (id: string) => setCart(cart.filter(item => item.id !== id));

    const calculateTotals = () => {
        let ht = 0;
        let ttc = 0;
        cart.forEach(item => {
            const lineHT = safeFloat(item.priceHT) * safeFloat(item.quantity);
            const rate = safeFloat(item.vatRate || 0.20);
            const lineTTC = lineHT * (1 + rate);
            ht += lineHT;
            ttc += lineTTC;
        });
        return { totalHT: ht, totalTTC: ttc };
    };

    const { totalHT, totalTTC } = calculateTotals();

    const handleSubmit = async () => {
        if (!selectedClient) return alert("Veuillez sélectionner un client");
        if (cart.length === 0) return alert("Le panier est vide");

        setLoading(true);
        try {
            const type = mode === 'QUOTE' ? 'DEVIS' : mode === 'CREDIT_NOTE' ? 'AVOIR' : 'FACTURE';
            
            await client.post('/legal/documents', {
                type,
                clientId: selectedClient.id,
                items: cart.map(item => ({
                    productId: item.isCustom ? null : item.id, 
                    productName: item.name, 
                    quantity: safeFloat(item.quantity), 
                    unitPrice: safeFloat(item.priceHT), 
                    vatRate: safeFloat(item.vatRate),
                    measureUnit: item.measureUnit || 'UNIT' // 🛑 FIX: Explicitly send measureUnit to backend!
                })),
                note: note,
                isCredit: mode === 'INVOICE' && paymentMode === 'CREDIT',
                initialPayment: mode === 'INVOICE' && paymentMode === 'CREDIT' ? safeFloat(initialPayment) : null,
                paymentMethod: mode === 'INVOICE' ? paymentMethod : null,
                paymentRef: mode === 'INVOICE' ? paymentRef : null
            });

            onSuccess();
        } catch (error: any) {
            alert("Erreur: " + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    const filteredClients = clients.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredProducts = products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    const getInitials = (name: string) => (name || '??').substring(0, 2).toUpperCase();

    // UI Helper to show unit in cart
    const getUnitLabel = (unit?: string) => { switch(unit) { case 'M': return 'm'; case 'KG': return 'kg'; case 'L': return 'L'; case 'UNIT': default: return 'u'; } };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-50 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/20">
                
                {/* Header */}
                <div className={`px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10 shrink-0`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl ${theme.bgSoft} ${theme.textMain} flex items-center justify-center shadow-inner`}>
                            <theme.icon size={20} strokeWidth={2.5}/>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 leading-tight flex items-center gap-2">
                                {theme.title}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${mode === 'QUOTE' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>STOCK A</span>
                            </h2>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mt-0.5">
                                <span className={step === 1 ? `${theme.textMain} font-bold` : ''}>1. Choix Client</span>
                                <ArrowRight size={10}/>
                                <span className={step === 2 ? `${theme.textMain} font-bold` : ''}>2. Panier</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X size={20}/></button>
                </div>

                {/* Step 1: Select Client */}
                {step === 1 && (
                    <div className="flex-1 overflow-hidden flex flex-col p-6 bg-slate-50/50">
                        <div className="max-w-3xl mx-auto w-full flex flex-col h-full">
                            <div className="mb-4 shrink-0"><h3 className="text-xl font-bold text-slate-800">Sélectionner un Client</h3></div>
                            <div className="relative mb-4 shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input autoFocus type="text" placeholder="Rechercher par nom ou ICE..." className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                {filteredClients.map(c => (
                                    <button key={c.id} onClick={() => { setSelectedClient(c); setSearchTerm(''); setStep(2); }} className={`w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:${theme.border} hover:${theme.bgLight} hover:shadow-sm transition-all text-left group`}>
                                        <div className={`w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 group-hover:${theme.bgSoft} group-hover:${theme.textMain} transition-colors`}>{getInitials(c.name)}</div>
                                        <div className="flex-1"><div className={`font-bold text-slate-700 text-sm group-hover:${theme.textDark}`}>{c.name}</div><div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">{c.ice && <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ICE: {c.ice}</span>}{c.city && <span>📍 {c.city}</span>}</div></div>
                                        <div className="text-slate-300 group-hover:text-blue-400 transform group-hover:translate-x-1 transition-all"><ChevronRight size={18}/></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Build Cart */}
                {step === 2 && (
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        {/* LEFT: PRODUCTS */}
                        <div className="w-full md:w-[65%] p-6 flex flex-col border-r border-slate-200 bg-white">
                            <div className="flex justify-between items-center mb-4 gap-4 shrink-0">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                    <input autoFocus type="text" placeholder="Rechercher produit..." className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                                {(mode === 'CREDIT_NOTE' || mode === 'QUOTE') && (
                                    <button onClick={() => setShowCustomItemForm(!showCustomItemForm)} className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm border ${showCustomItemForm ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}><PackagePlus size={18}/> {showCustomItemForm ? 'Fermer' : 'Hors Système'}</button>
                                )}
                            </div>

                            {/* Custom Item Form */}
                            {showCustomItemForm && (
                                <div className="p-5 bg-orange-50 border border-orange-100 rounded-2xl mb-4 shadow-inner animate-in fade-in slide-in-from-top-2 shrink-0">
                                    <h4 className="text-sm font-black text-orange-800 mb-3 flex items-center gap-2"><Undo2 size={16}/> Article Hors Système</h4>
                                    <div className="flex gap-3 mb-3">
                                        <input type="text" className="flex-1 p-2.5 border border-orange-200 rounded-lg text-sm" placeholder="Désignation" value={customItemName} onChange={e => setCustomItemName(e.target.value)} />
                                        <input type="number" className="w-32 p-2.5 border border-orange-200 rounded-lg text-sm" placeholder="Prix HT" value={customItemPrice} onChange={e => setCustomItemPrice(e.target.value)} />
                                        <select className="w-24 p-2.5 border border-orange-200 rounded-lg text-sm bg-white" value={customItemVat} onChange={e => setCustomItemVat(e.target.value)}>
                                            <option value="0.20">20%</option>
                                            <option value="0.10">10%</option>
                                        </select>
                                    </div>
                                    <button onClick={addCustomItem} className="w-full bg-orange-600 text-white font-bold py-2 rounded">Ajouter</button>
                                </div>
                            )}

                            {/* Product List */}
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {!showCustomItemForm && filteredProducts.map(p => (
                                    <button key={p.id} onClick={() => addToCart(p)} className={`w-full flex justify-between items-center p-3.5 border border-slate-100 rounded-xl hover:${theme.border} hover:${theme.bgLight} hover:shadow-sm transition-all group bg-white`}>
                                        <div className="text-left"><div className={`font-bold text-slate-800 text-sm group-hover:${theme.textDark}`}>{p.name}</div><div className="text-[11px] font-medium text-slate-400 mt-0.5">Stock: {p.quantity} {getUnitLabel(p.measureUnit)}</div></div>
                                        <div className={`font-mono font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 group-hover:bg-white group-hover:${theme.border} group-hover:${theme.textMain}`}>{formatMoney(p.priceHT)} MAD</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: CART & TOTALS */}
                        <div className="w-full md:w-[35%] bg-slate-50 flex flex-col border-l border-white shadow-xl z-20 relative h-full">
                            <div className="p-5 border-b border-slate-200 bg-white/50 backdrop-blur-sm shrink-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><ShoppingCart size={20} className="text-slate-400"/> Panier</h3>
                                    <div className="text-right"><div className="text-xs font-bold text-slate-400 uppercase">Client</div><div className="font-bold text-slate-800 truncate max-w-[120px]">{selectedClient?.name}</div></div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {cart.map(item => (
                                    <div key={item.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm relative">
                                        <button onClick={() => removeFromCart(item.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                                        <div className="font-bold text-sm text-slate-800 pr-6">{item.name}</div>
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center gap-1 bg-slate-100 rounded p-1">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-white rounded shadow-sm text-xs font-bold">-</button>
                                                <div className="flex items-center">
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        className="w-12 text-center bg-transparent text-xs font-bold outline-none"
                                                        value={item.quantity}
                                                        onChange={(e) => setQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                    />
                                                    <span className="text-[9px] font-bold text-slate-400 pr-1">{getUnitLabel(item.measureUnit)}</span>
                                                </div>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-white rounded shadow-sm text-xs font-bold">+</button>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 border border-slate-100 rounded flex items-center gap-0.5"><Percent size={8}/> {safeFloat(item.vatRate)*100}%</span>
                                                <div className="font-mono text-sm font-bold">{formatMoney(safeFloat(item.priceHT) * safeFloat(item.quantity))}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* FOOTER ACTIONS */}
                            <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30 shrink-0">
                                <div className="space-y-1 mb-4">
                                    <div className="flex justify-between text-xs font-medium text-slate-500"><span>Total HT</span> <span>{formatMoney(totalHT)}</span></div>
                                    <div className="flex justify-between text-xs font-medium text-slate-500"><span>TVA (Détail)</span> <span>{formatMoney(totalTTC - totalHT)}</span></div>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                                        <span className="font-bold text-slate-800">Total TTC</span> 
                                        <span className={`font-black text-2xl tracking-tight ${theme.textMain}`}>{formatMoney(totalTTC)} <span className="text-sm font-bold text-slate-400">MAD</span></span>
                                    </div>
                                </div>

                                {mode === 'INVOICE' && (
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 space-y-3">
                                        <div className="flex rounded-lg bg-slate-200 p-1">
                                            <button onClick={() => setPaymentMode('CASH')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${paymentMode === 'CASH' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><Wallet size={14}/> Comptant</button>
                                            <button onClick={() => setPaymentMode('CREDIT')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${paymentMode === 'CREDIT' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}><CreditCard size={14}/> Crédit</button>
                                        </div>
                                        {paymentMode === 'CREDIT' && (
                                            <div className="flex items-center gap-2 animate-in fade-in">
                                                <input type="number" className="flex-1 p-2 border border-blue-300 rounded-lg text-sm font-bold" placeholder="Montant payé (0.00)" value={initialPayment} onChange={e => setInitialPayment(e.target.value)} />
                                                <span className="text-xs font-bold text-red-500 whitespace-nowrap">Reste: {formatMoney(totalTTC - safeFloat(initialPayment))}</span>
                                            </div>
                                        )}
                                        {(paymentMode === 'CASH' || (paymentMode === 'CREDIT' && safeFloat(initialPayment) > 0)) && (
                                            <div className="grid grid-cols-2 gap-2 animate-in fade-in">
                                                <select className="col-span-1 p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                                    <option value="ESPECES">Espèces</option>
                                                    <option value="CHEQUE">Chèque</option>
                                                    <option value="VIREMENT">Virement</option>
                                                    <option value="LIVRAISON">À la livraison</option>
                                                </select>
                                                {(paymentMethod === 'CHEQUE' || paymentMethod === 'VIREMENT') && (
                                                    <input type="text" className="col-span-1 p-2 border border-slate-200 rounded-lg text-xs" placeholder="N° Ref / Chèque" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {(mode === 'CREDIT_NOTE' || mode === 'QUOTE') && <input type="text" className="w-full mb-4 p-2 bg-slate-50 border border-slate-200 rounded text-sm" placeholder={mode === 'QUOTE' ? "Note interne pour ce devis..." : "Motif du retour..."} value={note} onChange={e => setNote(e.target.value)} />}
                                
                                <button onClick={handleSubmit} disabled={loading || cart.length === 0} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg ${theme.button} flex justify-center items-center gap-2`}>
                                    {loading ? 'Traitement...' : mode === 'CREDIT_NOTE' ? 'Confirmer' : mode === 'QUOTE' ? 'Enregistrer Devis' : 'Valider'} {!loading && <ArrowRight size={18}/>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};