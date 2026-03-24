import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Plus, ShoppingCart, Trash2, Anchor, RotateCcw, 
  LayoutDashboard, Box, LogOut, History, X, Save, 
  Ruler, Weight, Droplets, ClipboardList, Printer, 
  FileText, Grid, User, PieChart, RefreshCw, ChevronRight,
  ArrowDownCircle, Pencil
} from 'lucide-react';

import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';
import { MovementHistory } from './MovementHistory';
import { InventorySheet } from './InventorySheet';
import { ClientSelector } from './ClientSelector';
import { ExecutiveDashboard } from './ExecutiveDashboard'; // ✅ Executive View
import { ProductForm } from './ProductForm'; // ✅ Advanced Product Form

interface ProductB {
  id: string; name: string; internalSku: string; purchaseCost: number; sellingPrice: number; quantity: number;
  measureUnit: 'UNIT' | 'METER' | 'KG' | 'LITER'; technicalSpecs?: string;
}

export const Dashboard = () => {
  // 1. SESSION & ROLES
  const user = JSON.parse(localStorage.getItem('marine_user') || '{}');
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

  if (!user.id) return <div className="h-screen flex items-center justify-center text-red-500">Session expirée.</div>;

  // 2. VIEW MODES
  const [viewMode, setViewMode] = useState<'OPERATIONAL' | 'EXECUTIVE'>('OPERATIONAL');
  
  // 3. POS STATE
  const [products, setProducts] = useState<ProductB[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [refresh, setRefresh] = useState(0);
  
  // Sub-Modes
  const [returnMode, setReturnMode] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [inventoryMode, setInventoryMode] = useState(false);
  const [quoteMode, setQuoteMode] = useState(false); 
  
  // Transaction State
  const [selectedProduct, setSelectedProduct] = useState<ProductB | null>(null);
  const [transactionQty, setTransactionQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'CREDIT' | 'DELIVERY'>('CASH');
  
  // Cart & Clients
  const [quoteCart, setQuoteCart] = useState<{product: ProductB, qty: number}[]>([]); 
  const [activeClient, setActiveClient] = useState<any>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);

  // Inventory
  const [inventoryInput, setInventoryInput] = useState<Record<string, number>>({});
  const [showInventorySheet, setShowInventorySheet] = useState(false);

  // Modals
  const [showProductForm, setShowProductForm] = useState(false);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  // 4. EXECUTIVE STATE
  const [statsData, setStatsData] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // --- FETCH DATA ---
  useEffect(() => {
    if (viewMode === 'OPERATIONAL') {
        client.get('/dashboard/products')
        .then(res => setProducts(res.data))
        .catch(err => console.error(err));
    } else {
        client.get(`/dashboard/stats?from=${dateFrom}&to=${dateTo}`)
        .then(res => setStatsData(res.data))
        .catch(err => console.error(err));
    }
  }, [refresh, viewMode, dateFrom, dateTo]);

  // --- HELPERS ---
  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
  
  const getUnitIcon = (unit: string) => { 
      switch(unit) { 
          case 'METER': return <span className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold"><Ruler size={10} /> Mètre</span>; 
          case 'KG': return <span className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold"><Weight size={10} /> Kg</span>; 
          case 'LITER': return <span className="flex items-center gap-1 text-[10px] bg-cyan-100 text-cyan-600 px-1.5 py-0.5 rounded font-bold"><Droplets size={10} /> L</span>; 
          default: return <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold"><Box size={10} /> Unité</span>; 
      } 
  };
  
  const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.internalSku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- ACTIONS ---
  const handleTransaction = async () => {
    if (!selectedProduct) return;
    
    if (quoteMode) {
        setQuoteCart([...quoteCart, { product: selectedProduct, qty: transactionQty }]);
        setSelectedProduct(null); setTransactionQty(1);
        return;
    }

    setSubmitting(true);
    const type = returnMode ? 'RETURN' : 'SALE_CASH';
    
    try {
      await client.post('/dashboard/transactions', { 
          productId: selectedProduct.id, 
          userId: user.id, 
          quantity: Number(transactionQty), 
          type,
          clientId: activeClient?.id,
          paymentMethod 
      });
      
      setRefresh(prev => prev + 1);
      
      const total = returnMode 
          ? -(selectedProduct.sellingPrice * Number(transactionQty)) 
          : (selectedProduct.sellingPrice * Number(transactionQty));

      setReceiptData({ 
          productName: selectedProduct.name, sku: selectedProduct.internalSku, 
          quantity: Number(transactionQty), unitPrice: selectedProduct.sellingPrice, total: total, 
          date: new Date(), id: Math.random().toString(36).substr(2, 9).toUpperCase(),
          measureUnit: selectedProduct.measureUnit, technicalSpecs: selectedProduct.technicalSpecs,
          clientName: activeClient?.name, paymentMethod: paymentMethod, isReturn: returnMode
      });
      setSelectedProduct(null); setTransactionQty(1); setPaymentMethod('CASH'); 
    } catch (err: any) { alert(`Erreur: ${err.response?.data?.error}`); } finally { setSubmitting(false); }
  };

  const handlePrintQuote = async () => {
      try {
          await Promise.all(quoteCart.map(item => 
              client.post('/dashboard/transactions', { 
                  productId: item.product.id, userId: user.id, quantity: item.qty, type: 'QUOTE', clientId: activeClient?.id
              })
          ));
      } catch (err) { console.error(err); }

      const content = document.getElementById('printable-quote-area');
      if (!content) return;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = content.innerHTML;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); 
  };

  const handleInventoryAdjust = async (p: ProductB) => {
      const realQty = inventoryInput[p.id];
      if (realQty === undefined || isNaN(realQty)) return;
      const diff = realQty - p.quantity;
      if (diff === 0) return;
      if (!confirm(`Ajuster ${p.name} ?\nSystème: ${p.quantity} -> Réel: ${realQty}`)) return;

      try {
          await client.post('/dashboard/transactions', { productId: p.id, userId: user.id, quantity: diff, type: 'ADJUSTMENT' });
          setRefresh(p => p + 1);
      } catch (err: any) { alert(`Erreur: ${err.response?.data?.error}`); }
  };

  const activeColor = quoteMode ? 'amber' : returnMode ? 'red' : inventoryMode ? 'purple' : 'blue';

  // 🛑 EXECUTIVE VIEW RENDER
  if (viewMode === 'EXECUTIVE') {
      return (
          <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-slate-50">
              <div className="flex justify-between items-center mb-8">
                  <div>
                      <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                          <PieChart className="text-emerald-600"/> Direction Générale
                      </h1>
                      <p className="text-slate-500 mt-1">Supervision Financière & Stratégique</p>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 gap-2 shadow-sm">
                          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-xs font-bold text-slate-600 outline-none" />
                          <span className="text-slate-300">➜</span>
                          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-xs font-bold text-slate-600 outline-none" />
                      </div>
                      <button onClick={() => setViewMode('OPERATIONAL')} className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 shadow-sm transition-all">
                          <LayoutDashboard size={18}/> Vue Opérationnelle
                      </button>
                  </div>
              </div>
              <ExecutiveDashboard data={statsData} />
          </div>
      );
  }

  // 🚀 POS / OPERATIONAL VIEW RENDER
  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden font-sans text-slate-900">
      
      {/* LEFT PANEL: PRODUCTS & GRID */}
      <div className="flex-1 flex flex-col border-r border-slate-200 bg-[#F8FAFC]">
        
        {/* POS HEADER */}
        <div className="h-20 px-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl transition-colors bg-${activeColor}-50 text-${activeColor}-600`}>
                  {quoteMode ? <FileText size={24}/> : returnMode ? <RotateCcw size={24} /> : inventoryMode ? <ClipboardList size={24} /> : <Anchor size={24} />}
              </div>
              <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">ISSLI PECHE</h1>
                  <p className={`text-xs font-bold uppercase tracking-wider mt-1 text-${activeColor}-500`}>
                      {quoteMode ? 'MODE DEVIS' : returnMode ? 'MODE RETOUR (RMA)' : inventoryMode ? 'MODE INVENTAIRE' : 'MODE VENTE'}
                  </p>
              </div>
           </div>

           <div className="flex items-center gap-3">
               {!historyMode && !inventoryMode && (
                   <div className="relative group w-64 xl:w-80 transition-all">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                       <input type="text" autoFocus placeholder="Scanner ou chercher..." className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
               )}

               {isAdmin && (
                  <button onClick={() => {setHistoryMode(!historyMode); setInventoryMode(false); setQuoteMode(false);}} className={`p-3 rounded-xl border-2 transition-all ${historyMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}><History size={20} /></button>
               )}
               
               {isAdmin && (
                   <button onClick={() => {setInventoryMode(!inventoryMode); setHistoryMode(false); setQuoteMode(false);}} className={`p-3 rounded-xl border-2 transition-all ${inventoryMode ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:border-purple-400'}`} title="Inventaire"><ClipboardList size={20} /></button>
               )}

               {!inventoryMode && !historyMode && (
                 <>
                    <button onClick={() => { setQuoteMode(!quoteMode); setReturnMode(false); setSelectedProduct(null); }} className={`px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm border ${quoteMode ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'}`}>DEVIS</button>
                    <button onClick={() => { setReturnMode(!returnMode); setQuoteMode(false); setSelectedProduct(null); }} className={`px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm border ${returnMode ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}>RETOUR</button>
                 </>
               )}

               {isAdmin && !historyMode && !inventoryMode && (
                   <button onClick={() => setShowProductForm(true)} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-200"><Plus size={20} /></button>
               )}

               {isAdmin && (
                   <button onClick={() => setViewMode('EXECUTIVE')} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-lg" title="Vue Direction">
                       <PieChart size={20} />
                   </button>
               )}
           </div>
        </div>

        {/* CONTENT GRID */}
        <div className="flex-1 overflow-auto p-6 relative">
            {historyMode ? <MovementHistory /> : inventoryMode ? (
                <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-slate-700">Ajustement de Stock</h3>
                        <button onClick={() => setShowInventorySheet(true)} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800">
                            <Printer size={16} /> Imprimer Fiche
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-slate-500 font-bold sticky top-0 z-10 border-b border-gray-100">
                                <tr>
                                    <th className="p-4">Produit</th>
                                    <th className="p-4 text-center">Théorique</th>
                                    <th className="p-4 text-center">Réel (Saisie)</th>
                                    <th className="p-4 text-center">Écart</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {products.map(p => {
                                    const realVal = inventoryInput[p.id];
                                    const hasInput = realVal !== undefined && !isNaN(realVal);
                                    const diff = hasInput ? realVal - p.quantity : 0;
                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-bold text-slate-700">{p.name} <span className="text-xs font-normal text-gray-400 block">{p.internalSku}</span></td>
                                            <td className="p-4 text-center font-mono text-slate-500">{p.quantity}</td>
                                            <td className="p-4 text-center">
                                                <input type="number" className="w-20 p-2 border rounded text-center font-bold focus:border-purple-500 outline-none" 
                                                    onChange={(e) => setInventoryInput({...inventoryInput, [p.id]: parseInt(e.target.value)})}
                                                />
                                            </td>
                                            <td className={`p-4 text-center font-bold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-green-500' : 'text-gray-300'}`}>
                                                {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleInventoryAdjust(p)} disabled={!hasInput || diff === 0} 
                                                    className="px-3 py-1 bg-purple-600 text-white rounded font-bold text-xs hover:bg-purple-50 disabled:opacity-20 disabled:cursor-not-allowed">
                                                    Corriger
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredProducts.map(p => (
                        <div key={p.id} onClick={() => { setSelectedProduct(p); setTransactionQty(1); }}
                            className={`group cursor-pointer bg-white rounded-2xl p-4 border-2 transition-all hover:scale-[1.02] shadow-sm flex flex-col justify-between h-[180px] relative
                            ${selectedProduct?.id === p.id ? `border-${activeColor}-500 ring-4 ring-${activeColor}-500/20` : 'border-transparent hover:border-slate-300'}`}>
                            
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{p.internalSku}</span>
                                    {p.quantity < 5 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{p.name}</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    {getUnitIcon(p.measureUnit)}
                                </div>
                            </div>
                            <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between items-end">
                                <div><p className="text-[10px] text-slate-400 font-bold uppercase">Stock</p><p className={`text-sm font-black ${p.quantity < 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.quantity}</p></div>
                                <div className={`text-xl font-black text-${activeColor}-600`}>{p.sellingPrice} <span className="text-[10px] text-slate-400">DH</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT SIDE: CART PANEL */}
      {!inventoryMode && !historyMode && (
          <div className="w-[400px] xl:w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col z-20">
              <div className={`p-6 border-b border-slate-100 flex justify-between items-center bg-${activeColor}-50`}>
                  <h2 className={`text-lg font-black uppercase tracking-wide flex items-center gap-2 text-${activeColor}-700`}>
                    {quoteMode ? <FileText size={20}/> : returnMode ? <RotateCcw size={20}/> : <ShoppingCart size={20}/>} 
                    {quoteMode ? 'Devis Estimatif' : returnMode ? 'Retour Article' : 'Panier Actuel'}
                  </h2>
              </div>
              
              <div className="flex-1 p-6 flex flex-col">
                {/* CLIENT SELECTOR */}
                <div className="mb-4">
                  <button onClick={() => setShowClientSelector(true)} className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-between transition-all ${activeClient ? `border-${activeColor}-500 bg-${activeColor}-50 text-${activeColor}-700` : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-3">
                          <User size={20} />
                          <span className="font-bold">{activeClient ? activeClient.name : 'Sélectionner Client'}</span>
                      </div>
                      {activeClient && <span className="text-xs font-mono bg-white px-2 py-1 rounded shadow-sm">{activeClient.phone}</span>}
                  </button>
                  {activeClient && <button onClick={(e) => { e.stopPropagation(); setActiveClient(null); }} className="text-xs text-red-400 hover:text-red-600 font-bold mt-1 ml-1">Retirer Client</button>}
                </div>

                {selectedProduct ? (
                   <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 flex-1 flex flex-col justify-center text-center relative overflow-hidden">
                            <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2">{selectedProduct.name}</h3>
                            <div className="flex items-center justify-center gap-6 mb-8">
                                <button onClick={() => setTransactionQty(Math.max(1, transactionQty - 1))} className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 hover:border-blue-500 hover:text-blue-500 text-3xl font-black transition-all flex items-center justify-center shadow-sm">-</button>
                                <div className="text-center w-24"><span className="text-6xl font-black text-slate-900 tracking-tighter">{transactionQty}</span><p className="text-xs font-bold text-slate-400 uppercase mt-1">{selectedProduct.measureUnit}</p></div>
                                <button onClick={() => setTransactionQty(transactionQty + 1)} className="w-16 h-16 rounded-2xl bg-white border-2 border-slate-200 text-slate-400 hover:border-blue-500 hover:text-blue-500 text-3xl font-black transition-all flex items-center justify-center shadow-sm">+</button>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-inner">
                                <div className="flex justify-between items-center pt-2 mt-2"><span className="text-xs font-bold uppercase text-slate-400">Total à {returnMode ? 'Rendre' : 'Payer'}</span><span className={`text-3xl font-black text-${activeColor}-600`}>{formatMAD(selectedProduct.sellingPrice * transactionQty)}</span></div>
                            </div>
                        </div>

                        {!quoteMode && (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 mb-4 shadow-sm">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Mode de {returnMode ? 'Remboursement' : 'Paiement'}</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setPaymentMethod('CASH')} className={`p-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>💵 Espèces</button>
                                    <button onClick={() => setPaymentMethod('CREDIT')} className={`p-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${paymentMethod === 'CREDIT' ? 'bg-red-50 border-red-500 text-red-700' : 'border-slate-200 text-slate-500'}`}>
                                        {returnMode ? '⚖️ Avoir Client' : '⏳ Crédit'}
                                    </button>
                                    {!returnMode && (
                                        <>
                                            <button onClick={() => setPaymentMethod('CHECK')} className={`p-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${paymentMethod === 'CHECK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 text-slate-500'}`}>🏦 Chèque</button>
                                            <button onClick={() => setPaymentMethod('DELIVERY')} className={`p-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${paymentMethod === 'DELIVERY' ? 'bg-orange-50 border-orange-500 text-orange-700' : 'border-slate-200 text-slate-500'}`}>🚚 Livraison</button>
                                        </>
                                    )}
                                </div>
                                {paymentMethod === 'CREDIT' && (
                                    <div className={`mt-2 text-[10px] font-bold bg-${returnMode ? 'green' : 'red'}-50 p-1.5 rounded text-center text-${returnMode ? 'green' : 'red'}-600`}>
                                        {returnMode ? "Le montant sera DÉDUIT de la dette du client." : "Ce montant sera AJOUTÉ à la dette du client."}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 h-20">
                            <button onClick={() => setSelectedProduct(null)} className="h-full rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-lg hover:bg-slate-50">Annuler</button>
                            <button onClick={handleTransaction} disabled={submitting} className={`h-full rounded-2xl font-black text-xl text-white shadow-xl flex items-center justify-center gap-3 bg-${activeColor}-600 hover:bg-${activeColor}-500`}>{submitting ? '...' : <>{quoteMode ? 'AJOUTER' : returnMode ? 'VALIDER' : 'ENCAISSER'} <ChevronRight size={24} /></>}</button>
                        </div>
                    </div>
                ) : quoteMode ? (
                    <div className="flex-1 flex flex-col" id="printable-quote-area">
                          <div className="flex-1 overflow-auto">
                            <div className="mb-6">
                                <h3 className="font-black text-xl uppercase">Devis</h3>
                                <p className="text-xs text-slate-500 mb-2">Document non contractuel (Silo B)</p>
                                {activeClient && <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg"><div className="font-bold text-amber-900">{activeClient.name}</div><div className="text-xs text-amber-700">{activeClient.phone}</div></div>}
                            </div>
                            <table className="w-full text-sm">
                                <thead className="border-b-2 border-slate-800 text-left"><tr><th>Art</th><th className="text-center">Qté</th><th className="text-right">Total</th><th></th></tr></thead>
                                <tbody className="divide-y">
                                    {quoteCart.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2">{item.product.name}</td>
                                            <td className="py-2 text-center">{item.qty}</td>
                                            <td className="py-2 text-right font-bold">{formatMAD(item.product.sellingPrice * item.qty)}</td>
                                            <td className="py-2 text-right text-red-400 cursor-pointer" onClick={() => setQuoteCart(quoteCart.filter((_, i) => i !== idx))}><Trash2 size={14}/></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="mt-8 pt-4 border-t-2 border-slate-800 flex justify-between items-center">
                                <span className="font-black text-xl uppercase">Total</span>
                                <span className="font-black text-2xl text-amber-600">{formatMAD(quoteCart.reduce((sum, i) => sum + (i.product.sellingPrice * i.qty), 0))}</span>
                            </div>
                          </div>
                          <button onClick={handlePrintQuote} className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2"><Printer size={20} /> IMPRIMER DEVIS</button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50"><ShoppingCart size={80} strokeWidth={1} className="mb-4" /><p className="text-lg font-bold uppercase tracking-widest">En attente de produit</p></div>
                )}
              </div>
          </div>
      )}

      {showClientSelector && <ClientSelector mode="INTERNAL" onSelect={(c: any) => { setActiveClient(c); setShowClientSelector(false); }} onClose={() => setShowClientSelector(false)} />}
      
      {/* ✅ NEW PRODUCT FORM MODAL */}
      {showProductForm && (
          <ProductForm onClose={() => setShowProductForm(false)} onSuccess={() => { setShowProductForm(false); setRefresh(p => p + 1); }} />
      )}

      {receiptData && <InternalDeliveryNote data={receiptData} onClose={() => setReceiptData(null)} />}
      
      {showInventorySheet && <InventorySheet products={products} mode="internal" onClose={() => setShowInventorySheet(false)} />}
    </div>
  );
};