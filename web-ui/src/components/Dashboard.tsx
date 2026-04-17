// web-ui/src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { 
  Search, Plus, ShoppingCart, RotateCcw, Anchor, 
  History, Pencil, Ruler, Weight, Droplets,
  ClipboardList, Box, LogOut, Grid, User,
  ChevronRight, FileText, PieChart, CreditCard, Truck, Banknote, Building2,
  AlertCircle, FileSpreadsheet, Trash, X, PlusCircle, MinusCircle 
} from 'lucide-react';

import client from '../api/client';
import { InternalDeliveryNote } from './InternalDeliveryNote';
import { MovementHistory } from './MovementHistory';
import { ClientSelector } from './ClientSelector';
import { ProductForm } from './ProductForm'; 
import { InternalQuoteWizard } from './InternalQuoteWizard'; 
import { ExecutiveDashboard } from './ExecutiveDashboard'; 
import { InternalAssetImport } from './InternalAssetImport';

interface ProductB {
  id: string; 
  name: string; 
  internalSku: string; 
  purchaseCost: number; 
  priceHT: number;      
  vatRate: number;     
  priceTTC: number;     
  quantity: number;
  measureUnit: string; 
  technicalSpecs?: string;
}

interface CartItem {
  product: ProductB;
  quantity: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  'CASH': 'ESPÈCES',
  'CHECK': 'CHÈQUE',
  'TRANSFER': 'VIREMENT',
  'CREDIT': 'CRÉDIT',
  'QUOTE': 'DEVIS'
};

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

  const [showAnonymousConfirm, setShowAnonymousConfirm] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TRANSFER' | 'CREDIT' | 'QUOTE'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');

  const [activeClient, setActiveClient] = useState<any>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductB | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [statsData, setStatsData] = useState<any>(null);
  
  const [showImportModal, setShowImportModal] = useState(false);

  const getSellingPrice = (p: ProductB) => Number(p.priceTTC || 0);

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

  const handleAddToCart = (p: ProductB) => {
    setCart(prev => {
        const existing = prev.find(item => item.product.id === p.id);
        if (existing) {
            return prev.map(item => item.product.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
        }
        return [...prev, { product: p, quantity: 1 }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
        if (item.product.id === productId) {
            const newQty = Math.max(0.1, item.quantity + delta);
            return { ...item, quantity: newQty };
        }
        return item;
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleDeleteProduct = async (e: React.MouseEvent, id: string, name: string) => {
      e.stopPropagation(); 
      if (!window.confirm(`⚠️ SUPPRESSION DÉFINITIVE\n\nVoulez-vous vraiment supprimer le produit "${name}" ?`)) return;
      
      try {
          await client.delete(`/internal/products/${id}`);
          setRefresh(p => p + 1);
          setCart(prev => prev.filter(item => item.product.id !== id)); 
      } catch (err: any) {
          alert("Erreur: " + (err.response?.data?.error || "Impossible de supprimer ce produit (il est probablement lié à un historique de mouvement)."));
      }
  };

  const cartTotal = cart.reduce((sum, item) => {
      const lineTotalCents = Math.round(getSellingPrice(item.product) * item.quantity * 100);
      return sum + lineTotalCents;
  }, 0) / 100;  

  const handleTransaction = async (bypassConfirm: boolean = false) => {
    if (cart.length === 0) return;
    
    if ((paymentMethod === 'CREDIT' || paymentMethod === 'QUOTE') && !activeClient) {
        alert("⚠️ Client requis pour une vente à crédit ou un devis.");
        setShowClientSelector(true);
        return;
    }

    if ((paymentMethod === 'CHECK' || paymentMethod === 'TRANSFER') && !paymentRef && !returnMode) {
        alert("⚠️ Veuillez saisir la référence (N° Chèque/Virement).");
        return;
    }

    let type = paymentMethod === 'CREDIT' ? 'SALE_CREDIT' : 'SALE_CASH'; 
    if (returnMode) type = 'RETURN';
    if (paymentMethod === 'QUOTE') type = 'QUOTE';

    for (const item of cart) {
        if ((type === 'SALE_CASH' || type === 'SALE_CREDIT') && item.product.quantity < item.quantity) {
            alert(`❌ Stock Insuffisant pour ${item.product.name} !\nDisponible : ${item.product.quantity} ${getUnitLabel(item.product.measureUnit)}`);
            return;
        }
    }

    if (!activeClient && (type === 'SALE_CASH' || type === 'SALE_CREDIT' || type === 'RETURN') && !bypassConfirm) {
        setShowAnonymousConfirm(true);
        return; 
    }

    setSubmitting(true);
    try {
      const batchId = 'TRX-' + Math.random().toString(36).substring(7).toUpperCase();

      await client.post('/internal/transactions/batch', { 
          items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: getSellingPrice(i.product) })),
          type,
          clientId: activeClient?.id,
          paymentMethod: type === 'QUOTE' ? undefined : paymentMethod,
          paymentRef
      });
      
      setRefresh(prev => prev + 1);
      
      setReceiptData({ 
          id: batchId,
          date: new Date(), 
          clientName: activeClient?.name,
          paymentMethod: type === 'QUOTE' ? 'DEVIS' : PAYMENT_LABELS[paymentMethod], 
          paymentRef, 
          isReturn: returnMode,
          isQuote: type === 'QUOTE',
          items: cart.map(item => {
              const lineTotalCents = Math.round(getSellingPrice(item.product) * item.quantity * 100);
              return {
                  productName: item.product.name,
                  sku: item.product.internalSku,
                  quantity: item.quantity,
                  unitPrice: getSellingPrice(item.product),
                  total: lineTotalCents / 100, 
                  measureUnit: item.product.measureUnit
              };
          })
      });

      setCart([]); setPaymentMethod('CASH'); setPaymentRef('');
    } catch (err: any) { 
        alert(err.response?.data?.error || "Erreur transaction"); 
        if(err.response?.status === 401) window.location.reload(); 
    } finally { setSubmitting(false); }
  };

  if (viewMode === 'EXECUTIVE') {
      return (
          <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
              <div className="flex justify-between items-center mb-8">
                  <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-3"><PieChart className="text-emerald-600"/> Tableau de Bord Opérationnel</h1></div>
                  <button onClick={() => setViewMode('OPERATIONAL')} className="px-4 py-2 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 shadow-sm transition-all"><Anchor size={18}/> Vue Magasin</button>
              </div>
              <ExecutiveDashboard data={statsData} />
          </div>
      );
  }

  return (
    <div className="h-screen flex bg-slate-100 overflow-hidden relative">
      
      {showAnonymousConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 border-2 border-amber-400">
                  <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                      <AlertCircle size={32} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Attention</h3>
                  <p className="text-sm text-slate-600 mb-8 font-medium leading-relaxed">
                      Aucun client sélectionné. {returnMode ? 'Ce retour' : 'Cette vente'} sera enregistré(e) sous <br/><strong className="text-slate-800">'CLIENT COMPTOIR'</strong>.
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
                  <h1 className="text-xl font-black text-slate-900 uppercase">Terminal de Vente</h1>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${returnMode ? 'text-red-500' : 'text-emerald-500'}`}>
                      {returnMode ? 'Gestion des Retours' : 'Ventes au Comptoir'}
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
               
               {isAdmin && (
                   <button onClick={() => setShowImportModal(true)} className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors" title="Importer CSV">
                       <FileSpreadsheet size={20} />
                   </button>
               )}
               {isAdmin && <button onClick={() => { setEditingProduct(null); setShowProductForm(true); }} className="p-2.5 bg-emerald-600 text-white rounded-xl" title="Nouveau Produit"><Plus size={20} /></button>}
               {isAdmin && <button onClick={() => setViewMode('EXECUTIVE')} className="p-2.5 bg-slate-900 text-white rounded-xl" title="Tableau de Bord"><PieChart size={20} /></button>}
           </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
            {historyMode ? <MovementHistory /> : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                        <div key={p.id} onClick={() => handleAddToCart(p)} className={`group cursor-pointer bg-white rounded-2xl p-4 border-2 transition-all hover:scale-[1.02] active:scale-95 ${cart.some(item => item.product.id === p.id) ? 'border-emerald-600 shadow-lg' : 'border-transparent shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{p.internalSku}</span>
                                {isAdmin && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setEditingProduct(p); 
                                                setShowProductForm(true); 
                                            }} 
                                            className="text-slate-400 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded p-1 transition-all"
                                            title="Modifier Produit"
                                        >
                                            <Pencil size={14}/>
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeleteProduct(e, p.id, p.name)} 
                                            className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded p-1 transition-all"
                                            title="Supprimer Produit"
                                        >
                                            <Trash size={14}/>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm h-10 line-clamp-2">{p.name}</h3>
                            <div className="mt-4 flex justify-between items-end border-t pt-2">
                                <div><p className="text-[9px] text-slate-400 font-bold uppercase">Stock</p><p className={`text-sm font-black ${p.quantity < 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.quantity} <span className="text-[10px] font-bold text-slate-400">{getUnitLabel(p.measureUnit)}</span></p></div>
                                <div className="text-lg font-black text-emerald-600">{getSellingPrice(p)} <span className="text-[9px] text-slate-400">DH</span></div>
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
            {cart.length > 0 ? (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="text-sm font-black text-slate-800 uppercase">Panier</h3>
                        <button onClick={() => setCart([])} className="text-[10px] font-bold text-red-500 hover:underline">Vider</button>
                    </div>

                    <div className="space-y-3">
                        {cart.map((item) => (
                            <div key={item.product.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative group">
                                <button onClick={() => removeFromCart(item.product.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors">
                                    <X size={14} />
                                </button>
                                <h4 className="text-xs font-bold text-slate-800 line-clamp-2 pr-4">{item.product.name}</h4>
                                <div className="flex justify-between items-center mt-3">
                                    <div className="flex items-center gap-2 bg-white rounded-lg border shadow-sm px-2 py-1">
                                        <button onClick={() => updateCartQty(item.product.id, -1)} className="text-slate-400 hover:text-emerald-600 transition-colors"><MinusCircle size={18}/></button>
                                        <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => updateCartQty(item.product.id, 1)} className="text-slate-400 hover:text-emerald-600 transition-colors"><PlusCircle size={18}/></button>
                                    </div>
                                    <span className="text-sm font-black text-slate-900">{formatMAD(getSellingPrice(item.product) * item.quantity)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-4 bg-slate-900 rounded-2xl text-white shadow-xl">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total TTC</p>
                        <h4 className="text-2xl font-black text-emerald-400">{formatMAD(cartTotal)}</h4>
                    </div>

                    {!returnMode && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                {['CASH', 'CHECK', 'TRANSFER', 'CREDIT'].map((m) => (
                                    <button 
                                      key={m} 
                                      onClick={() => setPaymentMethod(m as any)} 
                                      className={`p-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${paymentMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-600 hover:border-slate-300'}`}
                                    >
                                        {PAYMENT_LABELS[m]}
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
                    <p className="font-bold uppercase tracking-widest text-xs">Panier vide</p>
                </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-200">
              <button onClick={() => handleTransaction(false)} disabled={cart.length === 0 || submitting} 
                className={`w-full py-4 text-white font-black rounded-2xl shadow-lg disabled:opacity-50 transition-all active:scale-[0.98] ${returnMode ? 'bg-red-600 hover:bg-red-700' : paymentMethod === 'QUOTE' ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {submitting ? 'VALIDATION...' : returnMode ? 'VALIDER RETOUR' : paymentMethod === 'QUOTE' ? 'GÉNÉRER DEVIS' : 'VALIDER TRANSACTION'}
              </button>
          </div>
      </div>

      {showClientSelector && <ClientSelector mode="INTERNAL" onSelect={(c: any) => { setActiveClient(c); setShowClientSelector(false); }} onClose={() => setShowClientSelector(false)} />}
      
      {showProductForm && <ProductForm initialData={editingProduct} onCancel={() => setShowProductForm(false)} onSuccess={() => { setShowProductForm(false); setRefresh(p => p+1); }} />}
      
      {receiptData && <InternalDeliveryNote data={receiptData} onClose={() => setReceiptData(null)} />}
      {showQuoteWizard && <InternalQuoteWizard onCancel={() => setShowQuoteWizard(false)} onSuccess={() => { setShowQuoteWizard(false); setRefresh(p => p+1); }} />}
      
      {showImportModal && (
          <InternalAssetImport 
              onCancel={() => setShowImportModal(false)}
              onSuccess={() => {
                  setShowImportModal(false);
                  setRefresh(p => p + 1); 
              }}
          />
      )}

    </div>
  );
};