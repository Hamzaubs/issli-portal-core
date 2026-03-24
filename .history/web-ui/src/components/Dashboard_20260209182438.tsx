import React, { useEffect, useState } from 'react';
import { 
  Search, Plus, ShoppingCart, RotateCcw, Anchor, 
  History, Pencil, Ruler, Weight, Droplets,
  ClipboardList, Box, LogOut, Grid, User,
  ChevronRight, FileText, PieChart, CreditCard, Truck, Banknote, Building2
} from 'lucide-react';

import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';
import { MovementHistory } from './MovementHistory';
import { InventorySheet } from './InventorySheet';
import { ClientSelector } from './ClientSelector';
import { ProductForm } from './ProductForm'; 
import { InternalQuoteWizard } from './InternalQuoteWizard'; 
import { ExecutiveDashboard } from './ExecutiveDashboard'; 

interface ProductB {
  id: string; name: string; internalSku: string; purchaseCost: number; sellingPrice: number; quantity: number;
  measureUnit: string; technicalSpecs?: string;
}

export const Dashboard = ({ user }: { user?: any }) => {
  // 1. SESSION & AUTH
  const currentUser = user || JSON.parse(localStorage.getItem('marine_user') || '{}');
  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';

  if (!currentUser?.id) return <div className="h-screen flex items-center justify-center text-red-500 font-bold">Session expirée. Veuillez vous reconnecter.</div>;

  // 2. STATE MANAGEMENT
  const [products, setProducts] = useState<ProductB[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [refresh, setRefresh] = useState(0);
  
  // View Modes
  const [viewMode, setViewMode] = useState<'OPERATIONAL' | 'EXECUTIVE'>('OPERATIONAL');
  const [returnMode, setReturnMode] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [inventoryMode, setInventoryMode] = useState(false);
  
  // Wizards
  const [showQuoteWizard, setShowQuoteWizard] = useState(false); 

  // Transaction State
  const [selectedProduct, setSelectedProduct] = useState<ProductB | null>(null);
  const [transactionQty, setTransactionQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  // ✅ Payment Logic
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'CREDIT' | 'DELIVERY' | 'TRANSFER'>('CASH');
  const [paymentRef, setPaymentRef] = useState(''); // Stores Check # or Transfer Ref

  // Modals & Data
  const [activeClient, setActiveClient] = useState<any>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showInventorySheet, setShowInventorySheet] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductB | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // Stats Data
  const [statsData, setStatsData] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // 3. DATA FETCHING
  useEffect(() => {
    if (viewMode === 'OPERATIONAL') {
        client.get('/internal/products')
        .then(res => setProducts(res.data))
        .catch(err => console.error("Stock Load Error:", err));
    } else {
        client.get(`/internal/stats?from=${dateFrom}&to=${dateTo}`)
        .then(res => setStatsData(res.data))
        .catch(err => console.error("Stats Load Error:", err));
    }
  }, [refresh, viewMode, dateFrom, dateTo]);

  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
  
  const getUnitIcon = (unit: string) => { 
      switch(unit) { 
          case 'METER': case 'M': return <span className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold"><Ruler size={10} /> Mètre</span>; 
          case 'KG': return <span className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold"><Weight size={10} /> Kg</span>; 
          case 'LITER': case 'L': return <span className="flex items-center gap-1 text-[10px] bg-cyan-100 text-cyan-600 px-1.5 py-0.5 rounded font-bold"><Droplets size={10} /> L</span>; 
          default: return <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold"><Box size={10} /> Unité</span>; 
      } 
  };
  
  const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.internalSku && p.internalSku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 5. ACTIONS
  const handleTransaction = async () => {
    if (!selectedProduct) return;
    
    // Validation: Credit/Check/Delivery usually require a client
    if ((paymentMethod === 'CREDIT' || paymentMethod === 'DELIVERY') && !activeClient) {
        alert("⚠️ Action impossible : Vous devez sélectionner un CLIENT pour ce mode de paiement.");
        setShowClientSelector(true);
        return;
    }

    if ((paymentMethod === 'CHECK' || paymentMethod === 'TRANSFER') && !paymentRef) {
        alert("⚠️ Référence manquante : Veuillez saisir le N° de Chèque ou Virement.");
        return;
    }

    const type = returnMode ? 'RETURN' : 'SALE_CASH';
    if (type === 'SALE_CASH' && selectedProduct.quantity < transactionQty) {
        alert(`❌ Stock Insuffisant !\n\nDisponible : ${selectedProduct.quantity}\nDemandé : ${transactionQty}`);
        return;
    }

    setSubmitting(true);
    try {
      await client.post('/internal/transactions', { 
          productId: selectedProduct.id, 
          userId: currentUser.id, 
          quantity: Math.floor(Number(transactionQty)),
          type,
          clientId: activeClient?.id,
          paymentMethod,
          paymentRef // ✅ Sends the Check/Transfer Ref to Backend
      });
      
      setRefresh(prev => prev + 1);
      
      const total = returnMode ? -(selectedProduct.sellingPrice * Number(transactionQty)) : (selectedProduct.sellingPrice * Number(transactionQty));
      setReceiptData({ 
          productName: selectedProduct.name, sku: selectedProduct.internalSku, 
          quantity: Number(transactionQty), unitPrice: selectedProduct.sellingPrice, total: total, 
          date: new Date(), id: Math.random().toString(36).substr(2, 9).toUpperCase(),
          measureUnit: selectedProduct.measureUnit, technicalSpecs: selectedProduct.technicalSpecs,
          clientName: activeClient?.name,
          paymentMethod: paymentMethod,
          paymentRef: paymentRef, // ✅ Passed to Printer
          isReturn: returnMode 
      });
      setSelectedProduct(null); setTransactionQty(1); setPaymentMethod('CASH'); setPaymentRef('');
    } catch (err: any) { 
        alert(`Erreur Transaction: ${err.response?.data?.error || "Erreur inconnue"}`); 
    } finally { setSubmitting(false); }
  };

  if (viewMode === 'EXECUTIVE') {
      return (
          <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50">
              {/* (Executive Dashboard Header - Same as before) */}
              <div className="flex justify-between items-center mb-8">
                  <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-3"><PieChart className="text-emerald-600"/> Direction Générale</h1><p className="text-slate-500 mt-1">Supervision Financière & Stratégique</p></div>
                  <div className="flex items-center gap-3"><button onClick={() => setViewMode('OPERATIONAL')} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"><Anchor size={18}/> Vue Opérationnelle</button></div>
              </div>
              <ExecutiveDashboard data={statsData} />
          </div>
      );
  }

  const activeColorClass = returnMode ? 'bg-red-50 text-red-600' : inventoryMode ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600';

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden font-sans text-slate-900">
      
      {/* LEFT PANEL (Unchanged logic) */}
      <div className="flex-1 flex flex-col border-r border-slate-200 bg-[#F8FAFC]">
        <div className="h-20 px-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl transition-colors ${activeColorClass}`}>
                  {returnMode ? <RotateCcw size={24} /> : inventoryMode ? <ClipboardList size={24} /> : <Anchor size={24} />}
              </div>
              <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">STOCK B</h1>
                  <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${returnMode ? 'text-red-500' : inventoryMode ? 'text-purple-500' : 'text-emerald-500'}`}>
                      {returnMode ? 'MODE RETOUR (RMA)' : inventoryMode ? 'MODE INVENTAIRE' : 'MAGASIN INTERNE'}
                  </p>
              </div>
           </div>
           <div className="flex items-center gap-3">
               {!historyMode && !inventoryMode && <div className="relative group w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" autoFocus placeholder="Scanner ou chercher..." className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>}
               {isAdmin && <button onClick={() => {setHistoryMode(!historyMode); setInventoryMode(false);}} className={`p-3 rounded-xl border-2 transition-all ${historyMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}><History size={20} /></button>}
               <button onClick={() => setShowQuoteWizard(true)} className="px-4 py-3 rounded-xl font-bold text-sm bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-2 shadow-sm"><FileText size={18}/> Devis</button>
               <button onClick={() => { setReturnMode(!returnMode); setSelectedProduct(null); }} className={`px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm border ${returnMode ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}>RETOUR</button>
               {isAdmin && !historyMode && !inventoryMode && <button onClick={() => { setEditingProduct(null); setShowProductForm(true); }} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-200"><Plus size={20} /></button>}
               {isAdmin && <button onClick={() => setViewMode('EXECUTIVE')} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg"><PieChart size={20} /></button>}
           </div>
        </div>

        <div className="flex-1 overflow-auto p-6 relative">
            {historyMode ? <MovementHistory /> : inventoryMode ? (
                <InventorySheet products={products} mode="internal" onClose={() => setShowInventorySheet(false)} />
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredProducts.map(p => (
                        <div key={p.id} onClick={() => { setSelectedProduct(p); setTransactionQty(1); }} className={`group cursor-pointer bg-white rounded-2xl p-4 border-2 transition-all hover:scale-[1.02] shadow-sm flex flex-col justify-between h-[180px] relative ${selectedProduct?.id === p.id ? `border-${returnMode ? 'red' : 'emerald'}-600 ring-4 ring-${returnMode ? 'red' : 'emerald'}-500/20` : 'border-transparent hover:border-slate-300'}`}>
                            {isAdmin && <button onClick={(e) => { e.stopPropagation(); setEditingProduct(p); setShowProductForm(true); }} className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={14} /></button>}
                            <div>
                                <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{p.internalSku}</span>{p.quantity < 5 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}</div>
                                <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{p.name}</h3>
                                <div className="flex items-center gap-2 mt-2">{getUnitIcon(p.measureUnit)}</div>
                            </div>
                            <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between items-end">
                                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Stock</p><p className={`text-sm font-black ${p.quantity < 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.quantity}</p></div>
                                <div className={`text-xl font-black ${returnMode ? 'text-red-600' : 'text-emerald-600'}`}>{p.sellingPrice} <span className="text-[10px] text-slate-400">DH</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT SIDE: CART WITH ENHANCED PAYMENT LOGIC */}
      {!inventoryMode && !historyMode && (
          <div className="w-[400px] xl:w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col z-20">
              <div className={`p-6 border-b border-slate-100 flex justify-between items-center ${activeColorClass}`}>
                  <h2 className={`text-lg font-black uppercase tracking-wide flex items-center gap-2 ${returnMode ? 'text-red-700' : 'text-emerald-700'}`}>
                    {returnMode ? <RotateCcw size={20}/> : <ShoppingCart size={20}/>} 
                    {returnMode ? 'Retour Article' : 'Panier Actuel'}
                  </h2>
              </div>
              
              <div className="flex-1 p-6 flex flex-col">
                <div className="mb-4">
                  <button onClick={() => setShowClientSelector(true)} className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-between transition-all ${activeClient ? `border-${returnMode ? 'red' : 'emerald'}-600 bg-${returnMode ? 'red' : 'emerald'}-50 text-${returnMode ? 'red' : 'emerald'}-700` : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-3"><User size={20} /><span className="font-bold">{activeClient ? activeClient.name : 'Sélectionner Client'}</span></div>
                  </button>
                  {activeClient && <button onClick={(e) => { e.stopPropagation(); setActiveClient(null); }} className="text-xs text-red-400 hover:text-red-600 font-bold mt-1 ml-1">Retirer Client</button>}
                </div>

                {selectedProduct ? (
                   <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 flex-1 flex flex-col justify-center text-center relative overflow-hidden">
                            <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2">{selectedProduct.name}</h3>
                            <div className="flex items-center justify-center gap-6 mb-8">
                                <button onClick={() => setTransactionQty(Math.max(1, transactionQty - 1))} className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 text-3xl font-black transition-all flex items-center justify-center shadow-sm">-</button>
                                <div className="text-center w-24"><span className="text-6xl font-black text-slate-900 tracking-tighter">{transactionQty}</span><p className="text-xs font-bold text-slate-400 uppercase mt-1">{selectedProduct.measureUnit}</p></div>
                                <button onClick={() => setTransactionQty(transactionQty + 1)} className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 text-3xl font-black transition-all flex items-center justify-center shadow-sm">+</button>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-inner">
                                <div className="flex justify-between items-center pt-2 mt-2"><span className="text-xs font-bold uppercase text-slate-400">Total à {returnMode ? 'Rendre' : 'Payer'}</span><span className={`text-3xl font-black ${returnMode ? 'text-red-600' : 'text-emerald-600'}`}>{formatMAD(selectedProduct.sellingPrice * transactionQty)}</span></div>
                            </div>
                        </div>

                        {/* ✅ PAYMENT METHOD SELECTOR */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 mb-4 shadow-sm">
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setPaymentMethod('CASH')} className={`p-2 rounded-lg text-[10px] font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'text-slate-500 border-slate-200'}`}><Banknote size={16}/> ESPÈCES</button>
                                <button onClick={() => setPaymentMethod('CHECK')} className={`p-2 rounded-lg text-[10px] font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'CHECK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'text-slate-500 border-slate-200'}`}><FileText size={16}/> CHÈQUE</button>
                                <button onClick={() => setPaymentMethod('TRANSFER')} className={`p-2 rounded-lg text-[10px] font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'TRANSFER' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'text-slate-500 border-slate-200'}`}><Building2 size={16}/> VIREMENT</button>
                                <button onClick={() => setPaymentMethod('CREDIT')} className={`p-2 rounded-lg text-[10px] font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'CREDIT' ? 'bg-red-50 border-red-500 text-red-700' : 'text-slate-500 border-slate-200'}`}><CreditCard size={16}/> CRÉDIT</button>
                                <button onClick={() => setPaymentMethod('DELIVERY')} className={`col-span-2 p-2 rounded-lg text-[10px] font-bold border flex flex-col items-center gap-1 ${paymentMethod === 'DELIVERY' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'text-slate-500 border-slate-200'}`}><Truck size={16}/> PAIEMENT LIVRAISON</button>
                            </div>

                            {/* ✅ REFERENCE INPUT */}
                            {(paymentMethod === 'CHECK' || paymentMethod === 'TRANSFER') && (
                                <div className="mt-3 animate-in fade-in">
                                    <input type="text" placeholder={paymentMethod === 'CHECK' ? "Numéro de Chèque" : "Référence Virement"} 
                                        className="w-full p-3 border-2 border-slate-300 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                                        value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 h-20">
                            <button onClick={() => setSelectedProduct(null)} className="h-full rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-lg hover:bg-slate-50">Annuler</button>
                            <button onClick={handleTransaction} disabled={submitting} className={`h-full rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-3 transition-colors text-white ${returnMode ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                {submitting ? '...' : <>{returnMode ? 'VALIDER' : 'ENCAISSER'} <ChevronRight size={24} /></>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50"><ShoppingCart size={80} strokeWidth={1} className="mb-4" /><p className="text-lg font-bold uppercase tracking-widest">En attente de produit</p></div>
                )}
              </div>
          </div>
      )}

      {showClientSelector && <ClientSelector mode="INTERNAL" onSelect={(c: any) => { setActiveClient(c); setShowClientSelector(false); }} onClose={() => setShowClientSelector(false)} />}
      
      {showProductForm && (
          <ProductForm initialData={editingProduct} onCancel={() => { setShowProductForm(false); setEditingProduct(null); }} onSuccess={() => { setShowProductForm(false); setEditingProduct(null); setRefresh(p => p+1); }} />
      )}

      {receiptData && <InternalDeliveryNote data={receiptData} onClose={() => setReceiptData(null)} />}
      {showInventorySheet && <InventorySheet products={products} mode="internal" onClose={() => setShowInventorySheet(false)} />}
      {showQuoteWizard && <InternalQuoteWizard onCancel={() => setShowQuoteWizard(false)} onSuccess={() => { setShowQuoteWizard(false); setRefresh(p => p+1); }} />}
    </div>
  );
};