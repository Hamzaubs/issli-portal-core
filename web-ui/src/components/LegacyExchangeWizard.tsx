// web-ui/src/components/LegacyExchangeWizard.tsx
import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, Search, Plus, Trash2, Save, 
  AlertCircle, ChevronLeft, Package, User, TrendingUp, Calculator
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

// 🛡️ MATH UTILS
const safeFloat = (val: any): number => {
  if (!val) return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

const formatMoney = (val: number): string => {
  return val.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const LegacyExchangeWizard = () => {
  const navigate = useNavigate();
  
  // Data
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [legacyRef, setLegacyRef] = useState(''); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Return List (Credit) - MANUAL ENTRY ALLOWED (Legacy)
  const [returnedItems, setReturnedItems] = useState<any[]>([
    { name: '', priceHT: 0, purchaseCost: 0, vatRate: 0.20, quantity: 1 }
  ]);

  // Sale List (Debit) - MUST EXIST IN DB
  const [newItems, setNewItems] = useState<any[]>([]);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // 🛡️ Safe Fetch Data
  const extractArray = (payload: any) => {
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.data)) return payload.data;
      return [];
  };

  // Init Clients
  useEffect(() => {
    client.get('/legal/clients')
      .then(res => setClients(extractArray(res.data)))
      .catch(() => setClients([]));
  }, []);

  // Init Products Search (✅ FIXED PAGINATION CRASH)
  useEffect(() => {
    if (searchTerm.length > 2) {
      client.get(`/legal/products?search=${searchTerm}`)
        .then(res => setSearchResults(extractArray(res.data)))
        .catch(() => setSearchResults([]));
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  // 🧮 LIVE CALCULATOR
  const calculateTotal = (items: any[]) => {
    return items.reduce((sum, item) => {
      const ht = safeFloat(item.priceHT || item.unitPrice);
      const qty = safeFloat(item.quantity);
      const vat = safeFloat(item.vatRate || 0.20);
      return sum + (ht * qty * (1 + vat));
    }, 0);
  };

  const totalCredit = calculateTotal(returnedItems);
  const totalDebit = calculateTotal(newItems);
  const balance = totalDebit - totalCredit; 

  // Handlers
  const addReturnRow = () => setReturnedItems([...returnedItems, { name: '', priceHT: 0, purchaseCost: 0, vatRate: 0.20, quantity: 1 }]);
  const removeReturnRow = (idx: number) => setReturnedItems(returnedItems.filter((_, i) => i !== idx));
  
  const updateReturnRow = (idx: number, field: string, value: any) => {
    const updated = [...returnedItems];
    updated[idx][field] = value;
    setReturnedItems(updated);
  };

  const addNewItem = (p: any) => {
    setNewItems([...newItems, {
      productId: p.id, productName: p.name, unitPrice: p.priceHT,
      vatRate: p.vatRate, quantity: 1, measureUnit: p.measureUnit
    }]);
    setSearchTerm('');
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!selectedClient) return alert("ERREUR: Veuillez sélectionner un client.");
    if (totalCredit <= 0) return alert("ERREUR: Le montant du retour est nul.");
    if (!legacyRef && newItems.length > 0) {
        if(!confirm("Attention: Aucune référence facture d'origine (Legacy) n'a été saisie. Continuer ?")) return;
    }
    
    // Integrity Check
    for (const item of returnedItems) {
        if (!item.name || safeFloat(item.priceHT) < 0 || safeFloat(item.quantity) <= 0) {
           return alert("ERREUR: Vérifiez les articles retournés (Nom, Prix, Quantité).");
        }
    }

    try {
      setIsSubmitting(true);
      const payload = { 
        clientId: selectedClient, 
        legacyRef, 
        returnedItems: returnedItems.map(i => ({
          ...i,
          priceHT: safeFloat(i.priceHT),
          purchaseCost: safeFloat(i.purchaseCost),
          quantity: safeFloat(i.quantity),
          vatRate: safeFloat(i.vatRate)
        })), 
        newItems: newItems.map(i => ({
           ...i,
           unitPrice: safeFloat(i.unitPrice),
           quantity: safeFloat(i.quantity),
           vatRate: safeFloat(i.vatRate)
        }))
      };
      
      const res = await client.post('/legal/invoices/exchange', payload);
      
      let msg = "✅ OPÉRATION RÉUSSIE\n\n";
      if (res.data.invoice) {
          msg += `Facture générée : ${res.data.invoice.reference}\n`;
          msg += `Avoir généré : ${res.data.creditNote.reference}\n`;
          const bal = safeFloat(res.data.balance);
          if (bal > 0.5) msg += `\n⚠️ CLIENT DOIT PAYER : ${formatMoney(bal)} MAD`;
          else if (bal < -0.5) msg += `\nℹ️ CLIENT A UN CRÉDIT : ${formatMoney(Math.abs(bal))} MAD`;
          else msg += `\n✨ ECHANGE ÉQUILIBRÉ (0.00 MAD)`;
      } else {
          msg += `Avoir généré : ${res.data.creditNote.reference}\nStock mis à jour (Création produits Legacy).`;
      }
        
      alert(msg);
      navigate('/legal');
    } catch (e: any) {
      alert("ERREUR: " + (e.response?.data?.error || e.message));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/legal')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-2 font-bold text-sm">
            <ChevronLeft size={16}/> Retour
          </button>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg"><ArrowRightLeft size={24} /></div>
            Assistant Échanges
          </h1>
        </div>
        
        {/* BALANCE CARD */}
        <div className={`px-6 py-4 rounded-xl text-white shadow-xl min-w-[300px] text-right transition-colors duration-500 ${balance > 0 ? 'bg-slate-800' : balance < 0 ? 'bg-emerald-600' : 'bg-blue-600'}`}>
          <div className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1 flex items-center justify-end gap-2">
            <Calculator size={14}/>
            {newItems.length === 0 ? "Valeur Avoir" : balance > 0 ? "Reste à Payer" : balance < 0 ? "Crédit Client" : "Compensé"}
          </div>
          <div className="text-3xl font-mono font-black">{formatMoney(Math.abs(balance))} <span className="text-sm">MAD</span></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CLIENT CONFIG */}
        <div className="lg:col-span-12 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><User size={14}/> Client</label>
            <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
              value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
              <option value="">-- Sélectionner --</option>
              {/* 🛡️ DEFENSIVE MAP */}
              {(Array.isArray(clients) ? clients : []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Réf. Facture Origine (Legacy)</label>
            <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
              placeholder="Ex: FAC-ANCIENNE-001" value={legacyRef} onChange={e => setLegacyRef(e.target.value)} />
            <p className="text-[10px] text-slate-400 mt-1 italic">Référence de la facture papier d'origine (si disponible)</p>
          </div>
        </div>

        {/* LEFT: RETURNS (RED) - MANUAL ENTRY */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-800 font-bold shadow-sm">
            <AlertCircle className="shrink-0"/> 1. Le Client RAMÈNE (Legacy/Hors Stock)
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
            <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
              {returnedItems.map((item, idx) => (
                <div key={idx} className="bg-red-50/30 p-4 rounded-xl border border-red-100 relative">
                  <button onClick={() => removeReturnRow(idx)} className="absolute top-2 right-2 text-red-300 hover:text-red-600"><Trash2 size={16}/></button>
                  <div className="mb-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Désignation Produit</label>
                      <input className="w-full text-sm font-bold bg-white border border-red-200 rounded p-2 outline-none" 
                        placeholder="Ex: Moteur Yamaha 40CV..." value={item.name} onChange={e => updateReturnRow(idx, 'name', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">P. Achat</label>
                        <input type="number" step="0.01" className="w-full text-xs p-2 bg-white border border-slate-200 rounded"
                          value={item.purchaseCost} onChange={e => updateReturnRow(idx, 'purchaseCost', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">P. Vente</label>
                        <input type="number" step="0.01" className="w-full text-xs p-2 bg-white border border-slate-200 rounded font-bold text-slate-700"
                          value={item.priceHT} onChange={e => updateReturnRow(idx, 'priceHT', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">TVA</label>
                        <select className="w-full text-xs p-2 bg-white border border-slate-200 rounded"
                          value={item.vatRate} onChange={e => updateReturnRow(idx, 'vatRate', parseFloat(e.target.value))}>
                          <option value={0.20}>20%</option>
                          <option value={0.10}>10%</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Qté</label>
                        <input type="number" step="0.01" className="w-full text-xs p-2 bg-white border border-slate-200 rounded font-bold"
                          value={item.quantity} onChange={e => updateReturnRow(idx, 'quantity', e.target.value)} />
                      </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addReturnRow} className="w-full p-3 text-sm font-bold text-red-500 hover:bg-red-50 flex justify-center items-center gap-2 border-t border-slate-100">
              <Plus size={16}/> Ajouter Ligne Retour
            </button>
          </div>
          <div className="text-right font-bold text-red-600 text-lg px-4">
            Total Avoir: {formatMoney(totalCredit)} MAD
          </div>
        </div>

        {/* RIGHT: SALES (GREEN) - DATABASE SEARCH */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 text-emerald-800 font-bold shadow-sm">
            <Package className="shrink-0"/> 2. Le Client PREND (Stock Actuel)
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-100 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input className="w-full pl-10 p-2 bg-slate-50 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Scanner ou chercher produit..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-slate-200 z-10 max-h-60 overflow-y-auto m-4 rounded-xl">
                  {/* 🛡️ DEFENSIVE MAP */}
                  {(Array.isArray(searchResults) ? searchResults : []).map(p => (
                    <div key={p.id} onClick={() => addNewItem(p)} className="p-3 hover:bg-emerald-50 cursor-pointer flex justify-between border-b border-slate-50 text-sm">
                      <span className="font-bold text-slate-700">{p.name}</span>
                      <span className="font-mono text-emerald-600">{formatMoney(p.priceHT)} MAD</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 space-y-2 flex-1 max-h-[500px] overflow-y-auto custom-scrollbar">
              {newItems.length === 0 && <div className="text-center text-slate-300 text-sm italic py-12">Liste vide (Sélectionnez des produits)</div>}
              {newItems.map((item, idx) => {
                 const lineTotal = safeFloat(item.unitPrice) * safeFloat(item.quantity) * (1 + safeFloat(item.vatRate));
                 return (
                  <div key={idx} className="flex justify-between items-center p-3 bg-emerald-50/30 rounded-lg border border-emerald-100/50">
                    <div className="text-sm">
                      <div className="font-bold text-slate-700">{item.productName}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <input type="number" step="0.01" className="w-12 text-center bg-white border border-emerald-200 rounded text-xs" 
                            value={item.quantity} 
                            onChange={(e) => {
                                const updated = [...newItems];
                                updated[idx].quantity = e.target.value; 
                                setNewItems(updated);
                            }}
                          />
                          x {item.unitPrice} HT
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-emerald-700">{formatMoney(lineTotal)}</span>
                      <button onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </div>
                 );
              })}
            </div>
          </div>
          <div className="text-right font-bold text-emerald-600 text-lg px-4">
            Total Vente: {formatMoney(totalDebit)} MAD
          </div>
        </div>

        {/* SUBMIT */}
        <div className="lg:col-span-12 mt-4">
          <button onClick={handleSubmit} disabled={isSubmitting}
            className={`w-full py-4 text-white rounded-xl shadow-lg font-black text-lg flex items-center justify-center gap-3 transition-all ${
              isSubmitting ? 'bg-slate-400 cursor-wait' : 'bg-slate-800 hover:bg-slate-700 hover:scale-[1.01]'
            }`}>
            <Save size={24}/>
            {isSubmitting ? "TRAITEMENT SÉCURISÉ..." : 
              (newItems.length === 0 ? "VALIDER LE RETOUR (CRÉATION STOCK)" : "VALIDER L'ÉCHANGE")
            }
          </button>
        </div>

      </div>
    </div>
  );
};