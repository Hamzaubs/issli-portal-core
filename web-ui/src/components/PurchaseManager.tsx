// web-ui/src/components/PurchaseManager.tsx
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Printer, Calculator, CreditCard, PackageCheck, PackagePlus, XCircle, AlertTriangle } from 'lucide-react';
import { PurchaseService } from '../api/purchase';
import { SupplierService } from '../api/supplier';
import client from '../api/client'; 
import { PurchasePrint } from './PurchasePrint';

interface PurchaseManagerProps {
  mode: 'LEGAL' | 'INTERNAL';
}

export const PurchaseManager = ({ mode }: PurchaseManagerProps) => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [printingPurchase, setPrintingPurchase] = useState<any | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [type, setType] = useState('FACTURE_ACHAT');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  
  const [initialPayment, setInitialPayment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  
  const [items, setItems] = useState([{ id: Date.now().toString(), productId: '', productName: '', quantity: 1, measureUnit: 'UNIT', unitPriceHT: 0, vatRate: 0.20 }]);

  const [productModal, setProductModal] = useState({ isOpen: false, targetRowId: '' });
  const [newProduct, setNewProduct] = useState({ name: '', internalSku: '', priceHT: '', vatRate: '0.20', measureUnit: 'UNIT' });
  const [creatingProduct, setCreatingProduct] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, suppliersRes, productsRes] = await Promise.all([
        PurchaseService.getAll(mode), SupplierService.getAll(mode), client.get(mode === 'LEGAL' ? '/legal/products' : '/internal/products') 
      ]);
      setPurchases(purchasesRes);
      setSuppliers(suppliersRes.data || suppliersRes); 
      setProducts(productsRes.data || []);
    } catch (error) { console.error(`Erreur de chargement:`, error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [mode]);

  useEffect(() => {
      if (paymentMethod === 'CREDIT') {
          setInitialPayment('');
      }
  }, [paymentMethod]);

  const addItemRow = () => setItems(prev => [...prev, { id: Date.now().toString(), productId: '', productName: '', quantity: 1, measureUnit: 'UNIT', unitPriceHT: 0, vatRate: 0.20 }]);
  const removeItemRow = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  
  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'productId') {
            const prod = products.find(p => p.id === value);
            if (prod) {
                updated.productName = prod.name;
                updated.measureUnit = prod.measureUnit || 'UNIT';
                updated.unitPriceHT = prod.purchaseCost || prod.priceHT || 0;
                updated.vatRate = prod.vatRate || 0.20;
            } else if (!value) {
                updated.productName = '';
            }
        }
        return updated;
      }
      return item;
    }));
  };

  const purchaseTotals = items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const ht = Number(item.unitPriceHT) || 0;
      const vat = Number(item.vatRate) || 0;
      
      const lineHTCents = Math.round(qty * ht * 100);
      const lineTTCCents = Math.round(lineHTCents * (1 + vat));
      const lineTVACents = lineTTCCents - lineHTCents;
      
      return { 
          HT: acc.HT + (lineHTCents / 100), 
          TVA: acc.TVA + (lineTVACents / 100), 
          TTC: acc.TTC + (lineTTCCents / 100) 
      };
  }, { HT: 0, TVA: 0, TTC: 0 });

  const handleCreateProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreatingProduct(true);
      try {
          const endpoint = mode === 'LEGAL' ? '/legal/products' : '/internal/products';
          const res = await client.post(endpoint, { ...newProduct, purchaseCost: 0, quantity: 0 });
          const createdProduct = res.data;

          client.get(endpoint).then(pRes => setProducts(pRes.data || []));

          setItems(prev => prev.map(item => {
              if (item.id === productModal.targetRowId) {
                  return { ...item, productId: createdProduct.id, productName: createdProduct.name, measureUnit: createdProduct.measureUnit || 'UNIT', unitPriceHT: createdProduct.priceHT || createdProduct.purchaseCost || 0, vatRate: createdProduct.vatRate || 0.20 };
              }
              return item;
          }));

          setProductModal({ isOpen: false, targetRowId: '' });
          setNewProduct({ name: '', internalSku: '', priceHT: '', vatRate: '0.20', measureUnit: 'UNIT' });
      } catch (error: any) { alert(error.response?.data?.error || "Erreur création produit."); } finally { setCreatingProduct(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert("Veuillez sélectionner un fournisseur.");
    
    if (items.some(i => !i.productName || Number(i.quantity) <= 0)) {
        return alert("Veuillez remplir correctement les articles (La désignation et la quantité sont obligatoires).");
    }

    const acompte = Number(initialPayment) || 0;
    const acompteCents = Math.round(acompte * 100);
    const ttcCents = Math.round(purchaseTotals.TTC * 100);

    if (acompteCents > ttcCents) {
        return alert(`Impossible ! Le montant payé (${acompte.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} DH) ne peut pas dépasser le total TTC du document (${purchaseTotals.TTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} DH).`);
    }

    try {
      await PurchaseService.create(mode, { supplierId, type, reference, note, initialPayment: acompte, paymentMethod, paymentRef, items }); 
      
      setShowForm(false);
      setSupplierId(''); setReference(''); setNote(''); setInitialPayment(''); setPaymentMethod('CASH'); setPaymentRef('');
      setItems([{ id: Date.now().toString(), productId: '', productName: '', quantity: 1, measureUnit: 'UNIT', unitPriceHT: 0, vatRate: 0.20 }]);
      fetchData();
      alert("✅ Document enregistré avec succès !");
    } catch (error: any) { alert(error.response?.data?.error || "Erreur lors de l'enregistrement."); }
  };

  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(amount));
  
  const handleVoidPurchase = async (id: string) => {
      if (!window.confirm("⚠️ ATTENTION : Voulez-vous vraiment annuler ce document ? Les stocks et la trésorerie seront automatiquement inversés.")) return;
      try {
          await client.post(`/internal/purchases/${id}/void`);
          alert("✅ Document annulé et écritures inversées avec succès !");
          fetchData(); 
      } catch (error: any) {
          alert(error.response?.data?.error || "Erreur lors de l'annulation du document.");
      }
  };

  const isLegal = mode === 'LEGAL';
  const themeColor = isLegal ? 'indigo' : 'emerald';
  const getUnitLabel = (unit: string) => { switch(unit) { case 'KG': return 'kg'; case 'M': return 'm'; case 'L': return 'L'; default: return 'u'; } };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 bg-${themeColor}-500/10 rounded-xl text-${themeColor}-600 shadow-sm`}><PackageCheck size={28} strokeWidth={2} /></div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Réception & Achats {!isLegal && <span className="text-emerald-600">(Stock Global)</span>}</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{isLegal ? 'Factures Fournisseurs (Légal)' : 'Entrées de Stock & Dépenses Internes'}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={`px-5 py-3 bg-${isLegal ? 'indigo-600' : 'emerald-600'} text-white font-black text-xs tracking-wider uppercase rounded-xl hover:opacity-90 shadow-lg transition-all flex items-center gap-2 active:scale-95`}>
          <Plus size={18} /> Saisir Document
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-2xl mb-8 animate-in slide-in-from-top-4 duration-200 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-slate-100">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fournisseur *</label>
              <select required className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-${themeColor}-500`} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">-- Choisir un fournisseur --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ice || 'Sans ICE'})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Type Document</label>
              <select className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-${themeColor}-500`} value={type} onChange={e => setType(e.target.value)}>
                <option value="FACTURE_ACHAT">Facture d'Achat</option>
                <option value="BON_COMMANDE">Bon de Commande</option>
                <option value="BON_RECEPTION">Bon de Réception</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Réf. Document</label>
              <input type="text" placeholder="N° Facture/BL..." className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase outline-none focus:border-${themeColor}-500`} value={reference} onChange={e => setReference(e.target.value)} />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={16}/> Articles de la commande</h3>
            </div>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm focus-within:border-emerald-400 transition-colors relative">
                  <div className="w-8 text-center font-black text-slate-300 text-xs">{index + 1}</div>
                  
                  <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                      <div className="flex gap-2">
                          <select className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none" value={item.productId} onChange={e => updateItem(item.id, 'productId', e.target.value)}>
                              <option value="">-- Dépense / Charge Hors-Stock --</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button type="button" onClick={() => setProductModal({ isOpen: true, targetRowId: item.id })} className={`p-3 bg-${themeColor}-100 text-${themeColor}-700 rounded-lg hover:bg-${themeColor}-200 transition-colors`} title="Nouveau produit au catalogue"><PackagePlus size={18}/></button>
                      </div>
                      
                      {!item.productId && (
                          <div className="flex items-center gap-2 mt-1 relative">
                              <input type="text" required placeholder="Saisir désignation manuellement..." className="w-full p-2 bg-amber-50/50 border border-amber-200 rounded text-xs outline-none focus:border-amber-400" value={item.productName} onChange={e => updateItem(item.id, 'productName', e.target.value)} />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] font-black uppercase text-amber-600 bg-amber-100 px-2 py-0.5 rounded pointer-events-none">
                                  <AlertTriangle size={10}/> Ne sera pas stocké
                              </span>
                          </div>
                      )}
                  </div>

                  <div className="w-32 flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                      <input required type="number" min="0.01" step="0.01" placeholder="Qté" className="w-full p-3 text-sm font-black text-center bg-transparent outline-none" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} />
                      <span className="bg-slate-200 px-3 flex items-center text-xs font-black text-slate-500">{getUnitLabel(item.measureUnit)}</span>
                  </div>

                  <div className="w-32 flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                      <input required type="number" min="0" step="0.01" placeholder="P.U HT" className="w-full p-3 text-sm font-bold bg-transparent outline-none" value={item.unitPriceHT} onChange={e => updateItem(item.id, 'unitPriceHT', Number(e.target.value))} />
                  </div>

                  <select className="w-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none" value={item.vatRate} onChange={e => updateItem(item.id, 'vatRate', Number(e.target.value))}>
                    <option value={0}>0%</option><option value={0.10}>10%</option><option value={0.14}>14%</option><option value={0.20}>20%</option>
                  </select>

                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(item.id)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItemRow} className={`mt-2 w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 font-bold text-xs uppercase tracking-widest rounded-xl hover:border-${themeColor}-500 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 transition-all flex items-center justify-center gap-2`}>
                <Plus size={16}/> Ajouter une ligne
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-xl mt-4">
              <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                  <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1"><CreditCard size={12}/> Montant Payé</p>
                      <input 
                          type="number" 
                          step="0.01" 
                          max={purchaseTotals.TTC} 
                          disabled={paymentMethod === 'CREDIT'}
                          className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-white font-mono text-sm outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed" 
                          placeholder={paymentMethod === 'CREDIT' ? "0.00 (Crédit)" : "0.00 (Acompte)"} 
                          value={initialPayment} 
                          onChange={e => setInitialPayment(e.target.value)} 
                      />
                  </div>
                  <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Méthode</p>
                      <select className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-white text-xs font-bold outline-none focus:border-emerald-500" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                          <option value="CASH">Espèces</option>
                          <option value="CHEQUE">Chèque</option>
                          <option value="VIREMENT">Virement</option>
                          <option value="CREDIT">À Crédit (Non payé)</option>
                      </select>
                  </div>
              </div>

              <div className="lg:col-span-4 border-l border-r border-slate-800 px-6 flex flex-col justify-center">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1"><span>Total Net HT</span><span className="font-mono">{purchaseTotals.HT.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between items-center text-xs font-bold text-emerald-400"><span>TVA Déductible</span><span className="font-mono">+{purchaseTotals.TVA.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}</span></div>
              </div>

              <div className="lg:col-span-3 text-right flex flex-col items-end">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Calculator size={12}/> Total TTC</p>
                  <p className="font-black text-3xl mb-4">{purchaseTotals.TTC.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}</p>
                  <button type="submit" className={`w-full py-4 bg-${isLegal ? 'indigo-500 hover:bg-indigo-400' : 'emerald-500 hover:bg-emerald-400'} text-slate-900 font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95 flex items-center justify-center gap-2`}>
                      Valider le Document
                  </button>
              </div>
          </div>
        </form>
      )}

      {productModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><PackagePlus className={`text-${themeColor}-500`} size={24}/> Création Rapide (Produit)</h2>
                      <button onClick={() => setProductModal({ isOpen: false, targetRowId: '' })}><XCircle className="text-slate-400 hover:text-slate-600" size={24}/></button>
                  </div>
                  <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Référence (SKU) *</label><input required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-sm font-bold outline-none" value={newProduct.internalSku} onChange={e => setNewProduct({...newProduct, internalSku: e.target.value})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Désignation *</label><input required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} /></div>
                      <div className="grid grid-cols-3 gap-4">
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unité</label><select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={newProduct.measureUnit} onChange={e => setNewProduct({...newProduct, measureUnit: e.target.value})}><option value="UNIT">Unité (U)</option><option value="KG">Poids (KG)</option><option value="M">Longueur (M)</option><option value="L">Volume (L)</option></select></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Prix Vente HT *</label><input required type="number" min="0" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={newProduct.priceHT} onChange={e => setNewProduct({...newProduct, priceHT: e.target.value})} /></div>
                          <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">TVA Vente</label><select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" value={newProduct.vatRate} onChange={e => setNewProduct({...newProduct, vatRate: e.target.value})}><option value="0">0%</option><option value="0.10">10%</option><option value="0.14">14%</option><option value="0.20">20%</option></select></div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-4">
                          <button type="button" onClick={() => setProductModal({ isOpen: false, targetRowId: '' })} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Annuler</button>
                          <button type="submit" disabled={creatingProduct} className={`px-6 py-3 bg-${themeColor}-600 hover:bg-${themeColor}-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50`}>{creatingProduct ? 'Création...' : 'Créer & Ajouter'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? <div className="flex-1 flex items-center justify-center text-slate-400 font-bold tracking-widest animate-pulse">CHARGEMENT...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Document</th>
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Fournisseur</th>
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Finances (TTC)</th>
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-5">
                      <div className="font-black text-slate-800">{p.reference}</div>
                      <div className="text-xs font-bold text-slate-400 mt-1 uppercase">{new Date(p.issuedAt).toLocaleDateString('fr-MA')}</div>
                    </td>
                    <td className="p-5 font-bold text-slate-700 text-sm">
                      {p.supplier?.name || p.supplierNameSnapshot}
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col items-start gap-1">
                          <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-md border ${p.type === 'BON_COMMANDE' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>{p.type.replace('_', ' ')}</span>
                          <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-md border ${p.status === 'ANNULEE' ? 'bg-slate-100 border-slate-300 text-slate-500' : p.status === 'PAYEE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : p.status === 'PARTIEL' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-red-50 border-red-200 text-red-600'}`}>{p.status}</span>
                      </div>
                    </td>
                    <td className="p-5 text-right">
                        <div className={`font-black text-lg ${p.status === 'ANNULEE' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{formatMAD(p.totalTTC)}</div>
                        <div className="text-xs font-bold text-slate-400 mt-1">Payé: {formatMAD(p.amountPaid)}</div>
                    </td>
                    <td className="p-5 text-right flex justify-end gap-2">
                        <button onClick={() => setPrintingPurchase(p)} className={`p-2.5 text-slate-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-${themeColor}-200`} title="Imprimer document">
                            <Printer size={18} />
                        </button>
                        {p.status !== 'ANNULEE' && p.type !== 'PAIEMENT' && (
                            <button onClick={() => handleVoidPurchase(p.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-200" title="Annuler ce document">
                                <XCircle size={18} />
                            </button>
                        )}
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest">Aucun achat enregistré.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {printingPurchase && <PurchasePrint purchase={printingPurchase} onClose={() => setPrintingPurchase(null)} />}
    </div>
  );
};