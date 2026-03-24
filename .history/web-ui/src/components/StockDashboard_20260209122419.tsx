import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Plus, ShoppingCart, Trash2, Anchor, RotateCcw, 
  Settings, CreditCard, ChevronRight, LayoutDashboard, Box, LogOut,
  History, Pencil, X, Save, ArrowDownCircle, Ruler, Weight, Droplets,
  ClipboardList, Printer, CheckCircle, AlertTriangle, FileText, Grid, User,
  ArrowLeftRight, AlertCircle
} from 'lucide-react';

import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';
import { MovementHistory } from './MovementHistory';
import { InventorySheet } from './InventorySheet';
import { ClientSelector } from './ClientSelector';
import { ProductForm } from './ProductForm'; 
import { QuotePrinter } from './QuotePrinter'; 

interface ProductB {
  id: string; name: string; internalSku: string; purchaseCost: number; sellingPrice: number; quantity: number;
  measureUnit: 'UNIT' | 'METER' | 'KG' | 'LITER' | 'U' | 'M' | 'KG' | 'L'; technicalSpecs?: string;
}

export const StockDashboard = ({ user }: { user: any }) => {
  if (!user) return <div className="h-screen flex items-center justify-center text-red-500">Erreur session. Veuillez vous reconnecter.</div>;

  const [products, setProducts] = useState<ProductB[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [refresh, setRefresh] = useState(0);
  
  // Modes
  const [returnMode, setReturnMode] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [inventoryMode, setInventoryMode] = useState(false);
  const [quoteMode, setQuoteMode] = useState(false); 
  
  // Transaction State
  const [selectedProduct, setSelectedProduct] = useState<ProductB | null>(null);
  const [transactionQty, setTransactionQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'CREDIT' | 'DELIVERY'>('CASH');
  
  // Quote State
  const [quoteCart, setQuoteCart] = useState<{product: ProductB, qty: number}[]>([]); 
  const [showQuotePreview, setShowQuotePreview] = useState(false); 

  const [activeClient, setActiveClient] = useState<any>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showInventorySheet, setShowInventorySheet] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductB | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  useEffect(() => {
    client.get('/internal/products')
    .then(res => setProducts(res.data))
    .catch(err => console.error("Erreur chargement stock interne", err));
  }, [refresh]);

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

  // ✅ ROBUST STYLING LOGIC (Calculated before render)
  let containerColorClass = 'bg-emerald-50 text-emerald-600';
  let borderColorClass = 'border-emerald-600';
  let buttonColorClass = 'bg-emerald-600 hover:bg-emerald-700 text-white'; // Default Sale

  if (quoteMode) {
      containerColorClass = 'bg-amber-50 text-amber-600';
      borderColorClass = 'border-amber-500';
      buttonColorClass = 'bg-amber-500 hover:bg-amber-600 text-white';
  } else if (returnMode) {
      containerColorClass = 'bg-red-50 text-red-600';
      borderColorClass = 'border-red-600';
      buttonColorClass = 'bg-red-600 hover:bg-red-700 text-white';
  } else if (inventoryMode) {
      containerColorClass = 'bg-purple-50 text-purple-600';
      borderColorClass = 'border-purple-600';
      buttonColorClass = 'bg-purple-600 hover:bg-purple-700 text-white';
  }

  // --- ACTIONS ---
  const handleTransaction = async () => {
    if (!selectedProduct) return;
    
    if (paymentMethod === 'CREDIT' && !activeClient) {
        alert("⚠️ Action impossible : Vous devez sélectionner un CLIENT pour une vente à crédit.");
        setShowClientSelector(true);
        return;
    }

    // ✅ ADD TO QUOTE CART
    if (quoteMode) {
        setQuoteCart([...quoteCart, { product: selectedProduct, qty: transactionQty }]);
        setSelectedProduct(null); 
        setTransactionQty(1);
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
          userId: user.id, 
          quantity: Math.floor(Number(transactionQty)),
          type,
          clientId: activeClient?.id,
          paymentMethod 
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
          isReturn: returnMode 
      });
      setSelectedProduct(null); setTransactionQty(1); setPaymentMethod('CASH'); 
    } catch (err: any) { 
        alert(`Erreur Transaction: ${err.response?.data?.error || "Erreur inconnue"}`); 
    } finally { setSubmitting(false); }
  };

  // ✅ BATCH SAVER
  const handleSaveQuote = async () => {
    if (quoteCart.length === 0) return;
    setSubmitting(true);
    try {
        await client.post('/internal/transactions/batch', {
            items: quoteCart.map(i => ({
                productId: i.product.id,
                quantity: i.qty,
                unitPrice: i.product.sellingPrice
            })),
            type: 'QUOTE',
            clientId: activeClient?.id
        });
        
        alert("✅ Devis enregistré avec succès !");
        setQuoteCart([]); 
        setShowQuotePreview(false);
        setRefresh(prev => prev + 1);

    } catch (err: any) {
        alert("Erreur: " + err.response?.data?.error);
    } finally {
        setSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden font-sans text-slate-900">
      
      {/* LEFT PANEL */}
      <div className="flex-1 flex flex-col border-r border-slate-200 bg-[#F8FAFC]">
        <div className="h-20 px-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl transition-colors ${containerColorClass}`}>
                  {quoteMode ? <FileText size={24}/> : returnMode ? <RotateCcw size={24} /> : inventoryMode ? <ClipboardList size={24} /> : <Anchor size={24} />}
              </div>
              <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">STOCK B</h1>
                  <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${quoteMode ? 'text-amber-500' : returnMode ? 'text-red-500' : inventoryMode ? 'text-purple-500' : 'text-emerald-500'}`}>
                      {quoteMode ? 'MODE DEVIS' : returnMode ? 'MODE RETOUR (RMA)' : inventoryMode ? 'MODE INVENTAIRE' : 'MAGASIN INTERNE'}
                  </p>
              </div>
           </div>

           <div className="flex items-center gap-3">
               {!historyMode && !inventoryMode && (
                   <div className="relative group w-80">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                       <input type="text" autoFocus placeholder="Scanner ou chercher..." className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
               )}
               {user.role === 'SUPER_ADMIN' && <button onClick={() => {setHistoryMode(!historyMode); setInventoryMode(false); setQuoteMode(false);}} className={`p-3 rounded-xl border-2 transition-all ${historyMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}><History size={20} /></button>}
               {user.role === 'SUPER_ADMIN' && <button onClick={() => {setInventoryMode(!inventoryMode); setHistoryMode(false); setQuoteMode(false);}} className={`p-3 rounded-xl border-2 transition-all ${inventoryMode ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:border-purple-400'}`} title="Inventaire"><ClipboardList size={20} /></button>}

               {!inventoryMode && !historyMode && (
                 <>
                    <button onClick={() => { setQuoteMode(!quoteMode); setReturnMode(false); setSelectedProduct(null); }} className={`px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm border ${quoteMode ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'}`}>DEVIS</button>
                    <button onClick={() => { setReturnMode(!returnMode); setQuoteMode(false); setSelectedProduct(null); }} className={`px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm border ${returnMode ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}>RETOUR</button>
                 </>
               )}

               {user.role === 'SUPER_ADMIN' && !historyMode && !inventoryMode && <button onClick={() => { setEditingProduct(null); setShowFormModal(true); }} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-200"><Plus size={20} /></button>}
               {user.role === 'SUPER_ADMIN' ? <Link to="/" className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors shadow-lg"><Grid size={20} /></Link> : <button onClick={() => { localStorage.clear(); window.location.href='/'; }} className="p-3 bg-slate-200 text-slate-600 rounded-xl hover:bg-red-100 hover:text-red-600"><LogOut size={20} /></button>}
           </div>
        </div>

        <div className="flex-1 overflow-auto p-6 relative">
            {historyMode ? <MovementHistory /> : inventoryMode ? (
                <InventorySheet products={products} mode="internal" onClose={() => setShowInventorySheet(false)} />
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredProducts.map(p => (
                        <div key={p.id} onClick={() => { setSelectedProduct(p); setTransactionQty(1); }}
                            className={`group cursor-pointer bg-white rounded-2xl p-4 border-2 transition-all hover:scale-[1.02] shadow-sm flex flex-col justify-between h-[180px] relative
                            ${selectedProduct?.id === p.id ? `${borderColorClass} ring-4 ${quoteMode ? 'ring-amber-500/20' : returnMode ? 'ring-red-500/20' : 'ring-emerald-500/20'}` : 'border-transparent hover:border-slate-300'}`}>
                            {user.role === 'SUPER_ADMIN' && <button onClick={(e) => { e.stopPropagation(); setEditingProduct(p); setShowFormModal(true); }} className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={14} /></button>}
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{p.internalSku}</span>
                                    {p.quantity < 5 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{p.name}</h3>
                                <div className="flex items-center gap-2 mt-2">{getUnitIcon(p.measureUnit)}</div>
                            </div>
                            <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between items-end">
                                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Stock</p><p className={`text-sm font-black ${p.quantity < 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.quantity}</p></div>
                                <div className={`text-xl font-black ${quoteMode ? 'text-amber-600' : returnMode ? 'text-red-600' : 'text-emerald-600'}`}>{p.sellingPrice} <span className="text-[10px] text-slate-400">DH</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT SIDE: CART */}
      {!inventoryMode && !historyMode && (
          <div className="w-[400px] xl:w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col z-20">
              <div className={`p-6 border-b border-slate-100 flex justify-between items-center ${containerColorClass}`}>
                  <h2 className={`text-lg font-black uppercase tracking-wide flex items-center gap-2 ${quoteMode ? 'text-amber-700' : returnMode ? 'text-red-700' : 'text-emerald-700'}`}>
                    {quoteMode ? <FileText size={20}/> : returnMode ? <RotateCcw size={20}/> : <ShoppingCart size={20}/>} 
                    {quoteMode ? 'Devis Estimatif' : returnMode ? 'Retour Article' : 'Panier Actuel'}
                  </h2>
              </div>
              
              <div className="flex-1 p-6 flex flex-col">
                <div className="mb-4">
                  <button onClick={() => setShowClientSelector(true)} className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-between transition-all ${activeClient ? `${borderColorClass} ${containerColorClass}` : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
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
                                <div className="flex justify-between items-center pt-2 mt-2"><span className="text-xs font-bold uppercase text-slate-400">Total à {returnMode ? 'Rendre' : 'Payer'}</span><span className={`text-3xl font-black ${quoteMode ? 'text-amber-600' : returnMode ? 'text-red-600' : 'text-emerald-600'}`}>{formatMAD(selectedProduct.sellingPrice * transactionQty)}</span></div>
                            </div>
                        </div>

                        {!quoteMode && (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 mb-4 shadow-sm">
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setPaymentMethod('CASH')} className={`p-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>💵 Espèces</button>
                                    <button onClick={() => setPaymentMethod('CREDIT')} className={`p-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${paymentMethod === 'CREDIT' ? 'bg-red-50 border-red-500 text-red-700' : 'border-slate-200 text-slate-500'}`}>{returnMode ? '⚖️ Avoir Client' : '⏳ Crédit'}</button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 h-20">
                            <button onClick={() => setSelectedProduct(null)} className="h-full rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-lg hover:bg-slate-50">Annuler</button>
                            
                            {/* ✅ FIXED: Button classes are now computed in a variable 'buttonColorClass' above, guaranteed to be a valid string */}
                            <button 
                                onClick={handleTransaction} 
                                disabled={submitting} 
                                className={`h-full rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-3 transition-colors ${buttonColorClass}`}
                            >
                                {submitting ? '...' : <>{quoteMode ? 'AJOUTER' : returnMode ? 'VALIDER' : 'ENCAISSER'} <ChevronRight size={24} /></>}
                            </button>
                        </div>
                    </div>
                ) : quoteMode ? (
                      <div className="flex-1 flex flex-col p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                          <div className="flex-1 overflow-auto space-y-2 mb-4">
                              {quoteCart.length === 0 && <p className="text-center text-slate-400 italic mt-10">Ajoutez des produits au devis...</p>}
                              {quoteCart.map((item, idx) => (
                                  <div key={idx} className="bg-white p-3 rounded-lg border border-amber-100 flex justify-between items-center shadow-sm">
                                      <div>
                                          <div className="font-bold text-slate-700 text-sm">{item.product.name}</div>
                                          <div className="text-xs text-slate-400">{item.qty} x {item.product.sellingPrice} DH</div>
                                      </div>
                                      <button onClick={() => setQuoteCart(quoteCart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                                  </div>
                              ))}
                          </div>
                          <div className="mt-auto">
                               <div className="flex justify-between items-center mb-4 font-black text-xl text-amber-700">
                                  <span>TOTAL</span>
                                  <span>{formatMAD(quoteCart.reduce((acc, i) => acc + (i.product.sellingPrice * i.qty), 0))}</span>
                               </div>
                               <button 
                                  onClick={() => setShowQuotePreview(true)} 
                                  disabled={quoteCart.length === 0}
                                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                  <Printer size={20} /> APERÇU & ENREGISTRER
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
      {showFormModal && <ProductForm initialData={editingProduct} onCancel={() => { setShowFormModal(false); setEditingProduct(null); }} onSuccess={() => { setShowFormModal(false); setEditingProduct(null); setRefresh(p => p+1); }} />}
      {receiptData && <InternalDeliveryNote data={receiptData} onClose={() => setReceiptData(null)} />}
      {showInventorySheet && <InventorySheet products={products} mode="internal" onClose={() => setShowInventorySheet(false)} />}
      
      {showQuotePreview && (
          <QuotePrinter 
              items={quoteCart.map(i => ({ 
                  product: { name: i.product.name, internalSku: i.product.internalSku, measureUnit: i.product.measureUnit }, 
                  qty: i.qty, 
                  unitPrice: i.product.sellingPrice 
              }))}
              clientName={activeClient?.name}
              onClose={() => setShowQuotePreview(false)}
              onConfirm={handleSaveQuote} 
          />
      )}
    </div>
  );
};