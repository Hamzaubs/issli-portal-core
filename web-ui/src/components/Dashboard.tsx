// web-ui/src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { 
  Search, Plus, ShoppingCart, RotateCcw, Anchor, 
  History, Pencil, Ruler, Weight, Droplets,
  ClipboardList, Box, LogOut, Grid, User,
  ChevronRight, FileText, PieChart, CreditCard, Truck, Banknote, Building2,
  AlertCircle // ✅ Added for the warning modal
} from 'lucide-react';

import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';
import { MovementHistory } from './MovementHistory';
import { ClientSelector } from './ClientSelector';
import { ProductForm } from './ProductForm'; 
import { InternalQuoteWizard } from './InternalQuoteWizard'; 
import { ExecutiveDashboard } from './ExecutiveDashboard'; 

interface ProductB {
  id: string; name: string; internalSku: string; purchaseCost: number; sellingPrice: number; quantity: number;
  measureUnit: string; technicalSpecs?: string;
}

export const Dashboard = ({ user }: { user?: any }) => {
  const currentUser = user || JSON.parse(localStorage.getItem('marine_user') || '{}');
  const isAdmin = currentUser.role === 'SUPER_ADMIN';

  const [products, setProducts] = useState<ProductB[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [viewMode, setViewMode] = useState<'OPERATIONAL' | 'EXECUTIVE'>('OPERATIONAL');
  
  const [returnMode, setReturnMode] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [showQuoteWizard, setShowQuoteWizard] = useState(false); 

  // 🛑 NEW: Anonymous Transaction Shield State
  const [showAnonymousConfirm, setShowAnonymousConfirm] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<ProductB | null>(null);
  const [transactionQty, setTransactionQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TRANSFER' | 'CREDIT' | 'QUOTE'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');

  const [activeClient, setActiveClient] = useState<any>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductB | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [statsData, setStatsData] = useState<any>(null);

  // ✅ Helper to format unit for display
  const getUnitLabel = (unit?: string) => { 
      switch(unit) { 
          case 'M': return 'm'; 
          case 'KG': return 'kg'; 
          case 'L': return 'L'; 
          case 'UNIT': default: return 'u'; 
      } 
  };

  useEffect(() => {
    if (viewMode === 'OPERATIONAL') {
        client.get('/internal/products').then(res => setProducts(res.data));
    } else {
        client.get(`/internal/stats`).then(res => setStatsData(res.data));
    }
  }, [refresh, viewMode]);

  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
  
  // ✅ Updated to accept a bypass parameter for the confirmation modal
  const handleTransaction = async (bypassConfirm: boolean = false) => {
    if (!selectedProduct) return;
    
    if ((paymentMethod === 'CREDIT' || paymentMethod === 'QUOTE') && !activeClient) {
        alert("⚠️ Client requis pour une vente à crédit ou un devis.");
        setShowClientSelector(true);
        return;
    }

    if ((paymentMethod === 'CHECK' || paymentMethod === 'TRANSFER') && !paymentRef) {
        alert("⚠️ Veuillez saisir la référence (N° Chèque/Virement).");
        return;
    }

    let type = 'SALE_CASH';
    if (returnMode) type = 'RETURN';
    if (paymentMethod === 'QUOTE') type = 'QUOTE';

    if (type === 'SALE_CASH' && selectedProduct.quantity < transactionQty) {
        alert(`❌ Stock Insuffisant !\nDisponible : ${selectedProduct.quantity} ${getUnitLabel(selectedProduct.measureUnit)}`);
        return;
    }

    // 🛑 NEW: ANONYMOUS CHECKOUT SHIELD (Bypasses browser popup blockers using React DOM)
    if (!activeClient && (type === 'SALE_CASH' || type === 'RETURN') && !bypassConfirm) {
        setShowAnonymousConfirm(true);
        return; // Halt execution and wait for user to click Continue on the modal
    }

    setSubmitting(true);
    try {
      await client.post('/internal/transactions', { 
          productId: selectedProduct.id, 
          userId: currentUser.id, 
          quantity: transactionQty,
          type,
          clientId: activeClient?.id,
          paymentMethod: type === 'QUOTE' ? undefined : paymentMethod,
          paymentRef,
          measureUnit: selectedProduct.measureUnit || 'UNIT' // 🛑 FIX: Inject measureUnit into Silo B payload
      });
      
      setRefresh(prev => prev + 1);
      setReceiptData({ 
          productName: selectedProduct.name, sku: selectedProduct.internalSku, 
          quantity: transactionQty, unitPrice: selectedProduct.sellingPrice, 
          total: selectedProduct.sellingPrice * transactionQty, 
          date: new Date(), id: 'TRX-' + Math.random().toString(36).substring(7).toUpperCase(),
          measureUnit: selectedProduct.measureUnit, // Ensure it goes to the printer
          clientName: activeClient?.name,
          paymentMethod: type === 'QUOTE' ? 'DEVIS' : paymentMethod, 
          paymentRef, 
          isReturn: returnMode,
          isQuote: type === 'QUOTE' 
      });
      setSelectedProduct(null); setTransactionQty(1); setPaymentMethod('CASH'); setPaymentRef('');
    } catch (err: any) { 
        alert(err.response?.data?.error || "Erreur transaction"); 
    } finally { setSubmitting(false); }
  };

  if (viewMode === 'EXECUTIVE') {
      return (
          <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
              <div className="flex justify-between items-center mb-8">
                  <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-3"><PieChart className="text-emerald-600"/> Dashboard Silo B</h1></div>
                  <button onClick={() => setViewMode('OPERATIONAL')} className="px-4 py-2 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"><Anchor size={18}/> Vue Magasin</button>
              </div>
              <ExecutiveDashboard data={statsData} />
          </div>
      );
  }

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden relative">
      
      {/* 🛑 CUSTOM CONFIRMATION MODAL OVERLAY */}
      {showAnonymousConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 border-2 border-amber-400">
                  <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                      <AlertCircle size={32} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Attention</h3>
                  <p className="text-sm text-slate-600 mb-8 font-medium leading-relaxed">
                      Aucun client sélectionné. {returnMode ? 'Ce retour' : 'Cette vente'} sera enregistré(e) sous <br/><strong className="text-slate-800">'CLIENT COMPTOIR'</strong> (Anonyme).
                      <br/><br/>
                      Voulez-vous vraiment continuer ?
                  </p>
                  <div className="flex gap-3">
                      <button onClick={() => setShowAnonymousConfirm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                          Annuler
                      </button>
                      <button onClick={() => { setShowAnonymousConfirm(false); handleTransaction(true); }} className="flex-1 py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition-colors">
                          Continuer
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-1 flex flex-col border-r border-slate-200 bg-[#F8FAFC]">
        <div className="h-20 px-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${returnMode ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {returnMode ? <RotateCcw size={24} /> : <Anchor size={24} />}
              </div>
              <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase">Marine Ops</h1>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${returnMode ? 'text-red-500' : 'text-emerald-500'}`}>
                      {returnMode ? 'Mode Retour' : 'Stock & Vente'}
                  </p>
              </div>
           </div>
           <div className="flex items-center gap-3">
               <div className="relative w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl font-bold text-sm outline-none focus:bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </div>
               
               <button onClick={() => setShowQuoteWizard(true)} className="px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all flex items-center gap-2">
                   <FileText size={16}/> DEVIS
               </button>

               <button onClick={() => setHistoryMode(!historyMode)} className={`p-2.5 rounded-xl border-2 ${historyMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border-slate-200'}`}><History size={20} /></button>
               <button onClick={() => setReturnMode(!returnMode)} className={`px-4 py-2.5 rounded-xl font-bold text-xs border ${returnMode ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border-slate-200'}`}>RETOUR</button>
               {isAdmin && <button onClick={() => { setEditingProduct(null); setShowProductForm(true); }} className="p-2.5 bg-emerald-600 text-white rounded-xl"><Plus size={20} /></button>}
               {isAdmin && <button onClick={() => setViewMode('EXECUTIVE')} className="p-2.5 bg-slate-900 text-white rounded-xl"><PieChart size={20} /></button>}
           </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
            {historyMode ? <MovementHistory /> : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                        <div key={p.id} onClick={() => setSelectedProduct(p)} className={`group cursor-pointer bg-white rounded-2xl p-4 border-2 transition-all ${selectedProduct?.id === p.id ? 'border-emerald-600 shadow-lg' : 'border-transparent shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-2"><span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{p.internalSku}</span></div>
                            <h3 className="font-bold text-slate-800 text-sm h-10 line-clamp-2">{p.name}</h3>
                            <div className="mt-4 flex justify-between items-end border-t pt-2">
                                {/* ✅ DISPLAY UNIT NEXT TO STOCK */}
                                <div><p className="text-[9px] text-slate-400 font-bold uppercase">Stock</p><p className={`text-sm font-black ${p.quantity < 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.quantity} <span className="text-[10px] font-bold text-slate-400">{getUnitLabel(p.measureUnit)}</span></p></div>
                                <div className="text-lg font-black text-emerald-600">{p.sellingPrice} <span className="text-[9px] text-slate-400">DH</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      <div className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-2xl z-20">
          <div className="p-6 border-b bg-slate-50">
              <button onClick={() => setShowClientSelector(true)} className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-between ${activeClient ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-400'}`}>
                  <div className="flex items-center gap-3"><User size={20} /><span className="font-bold">{activeClient ? activeClient.name : 'Choisir Client'}</span></div>
              </button>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedProduct ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="text-center">
                        <h3 className="text-xl font-black text-slate-800">{selectedProduct.name}</h3>
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <button onClick={() => setTransactionQty(Math.max(1, transactionQty - 1))} className="w-12 h-12 bg-slate-100 rounded-xl font-black hover:bg-slate-200">-</button>
                            {/* ✅ DISPLAY UNIT NEXT TO QUANTITY INPUT */}
                            <div className="flex items-baseline">
                                <span className="text-4xl font-black text-slate-900">{transactionQty}</span>
                                <span className="text-xs font-bold text-slate-400 ml-1 pb-1">{getUnitLabel(selectedProduct.measureUnit)}</span>
                            </div>
                            <button onClick={() => setTransactionQty(transactionQty + 1)} className="w-12 h-12 bg-slate-100 rounded-xl font-black hover:bg-slate-200">+</button>
                        </div>
                        <div className="mt-8 p-4 bg-slate-900 rounded-2xl text-white">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Total {paymentMethod === 'QUOTE' ? 'Estimé' : ''}</p>
                            <h4 className="text-2xl font-black">{formatMAD(selectedProduct.sellingPrice * transactionQty)}</h4>
                        </div>
                    </div>

                    {!returnMode && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                {['CASH', 'CHECK', 'TRANSFER', 'CREDIT'].map((m) => (
                                    <button key={m} onClick={() => setPaymentMethod(m as any)} className={`p-3 rounded-xl border-2 text-[10px] font-bold ${paymentMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-600 hover:border-slate-300'}`}>
                                        {m}
                                    </button>
                                ))}
                            </div>
                            
                            <button onClick={() => setPaymentMethod('QUOTE')} className={`w-full p-3 rounded-xl border-2 text-[11px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'QUOTE' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'}`}>
                                📝 CRÉER UN DEVIS
                            </button>
                        </div>
                    )}

                    {(paymentMethod === 'CHECK' || paymentMethod === 'TRANSFER') && !returnMode && (
                        <input type="text" placeholder="Référence..." className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none font-bold text-sm focus:border-emerald-500" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} />
                    )}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-80">
                    <ShoppingCart size={64} className="mb-4 opacity-50"/>
                    <p className="font-bold uppercase tracking-widest text-xs mb-8">Panier vide</p>
                </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-200">
              {/* ✅ Call handleTransaction() without args natively, modal triggers it with (true) */}
              <button onClick={() => handleTransaction(false)} disabled={!selectedProduct || submitting} 
                className={`w-full py-4 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-colors ${returnMode ? 'bg-red-600 hover:bg-red-700' : paymentMethod === 'QUOTE' ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {submitting ? '...' : returnMode ? 'VALIDER RETOUR' : paymentMethod === 'QUOTE' ? 'GÉNÉRER DEVIS' : 'VALIDER TRANSACTION'}
              </button>
          </div>
      </div>

      {showClientSelector && <ClientSelector mode="INTERNAL" onSelect={(c: any) => { setActiveClient(c); setShowClientSelector(false); }} onClose={() => setShowClientSelector(false)} />}
      {showProductForm && <ProductForm initialData={editingProduct} onCancel={() => setShowProductForm(false)} onSuccess={() => { setShowProductForm(false); setRefresh(p => p+1); }} />}
      {receiptData && <InternalDeliveryNote data={receiptData} onClose={() => setReceiptData(null)} />}
      {showQuoteWizard && <InternalQuoteWizard onCancel={() => setShowQuoteWizard(false)} onSuccess={() => { setShowQuoteWizard(false); setRefresh(p => p+1); }} />}
    </div>
  );
};