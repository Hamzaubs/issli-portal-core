import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Printer } from 'lucide-react';
import { PurchaseService } from '../api/purchase';
import { SupplierService } from '../api/supplier';
import { PurchasePrint } from './PurchasePrint';

interface PurchaseManagerProps {
  mode: 'LEGAL' | 'INTERNAL';
}

export const PurchaseManager = ({ mode }: PurchaseManagerProps) => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [printingPurchase, setPrintingPurchase] = useState<any | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [type, setType] = useState('FACTURE_ACHAT');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  
  // Dynamic Items Array
  const [items, setItems] = useState([{ productName: '', quantity: 1, unitPriceHT: 0, vatRate: 0.20 }]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, suppliersRes] = await Promise.all([
        PurchaseService.getAll(mode), // ✅ Fixed: Added mode
        SupplierService.getAll(mode) // ✅ Fixed: Added mode
      ]);
      setPurchases(purchasesRes);
      setSuppliers(suppliersRes.data || suppliersRes); 
    } catch (error) {
      console.error(`Erreur de chargement (${mode}):`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, [mode]); // Refetch if we switch between Legal and POS

  // Handle Dynamic Items
  const addItemRow = () => setItems([...items, { productName: '', quantity: 1, unitPriceHT: 0, vatRate: 0.20 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert("Veuillez sélectionner un fournisseur.");
    if (items.some(i => !i.productName || i.quantity <= 0)) return alert("Veuillez remplir correctement les articles.");

    try {
      // ✅ Fixed: Added mode and moved data to 2nd argument
      await PurchaseService.create(mode, { supplierId, type, reference, note, items }); 
      
      setShowForm(false);
      // Reset Form
      setSupplierId(''); setReference(''); setNote('');
      setItems([{ productName: '', quantity: 1, unitPriceHT: 0, vatRate: 0.20 }]);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.error || "Erreur lors de la création.");
    }
  };

  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(amount));

  // Dynamic Theme UI
  const isLegal = mode === 'LEGAL';
  const themeColor = isLegal ? 'indigo' : 'emerald';

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className={`p-3 bg-${themeColor}-500/10 rounded-xl text-${themeColor}-600`}>
            <ShoppingCart size={28} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Achats & Dépenses {!isLegal && <span className="text-emerald-600">(B)</span>}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {isLegal ? 'Factures Fournisseurs & Bons de Commande' : 'Suivi des dépenses internes'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className={`px-4 py-2.5 bg-${isLegal ? 'indigo-600' : 'emerald-600'} text-white font-bold rounded-xl hover:opacity-90 shadow-lg transition-all flex items-center gap-2`}
        >
          <Plus size={18} /> Nouvel Achat
        </button>
      </div>

      {/* CREATE FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-4 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fournisseur *</label>
              <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">-- Sélectionner --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ice || 'Sans ICE'})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Type de Document</label>
              <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={type} onChange={e => setType(e.target.value)}>
                <option value="FACTURE_ACHAT">Facture d'Achat</option>
                <option value="BON_COMMANDE">Bon de Commande</option>
                <option value="BON_RECEPTION">Bon de Réception</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Référence (Optionnel)</label>
              <input type="text" placeholder="N° Facture..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={reference} onChange={e => setReference(e.target.value)} />
            </div>
          </div>

          {/* DYNAMIC ITEMS LIST */}
          <div className="mb-6">
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase">Articles de la commande</h3>
              <button type="button" onClick={addItemRow} className={`text-${themeColor}-600 text-sm font-bold flex items-center gap-1 hover:underline`}>
                <Plus size={16}/> Ajouter Ligne
              </button>
            </div>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <input required type="text" placeholder="Désignation" className="flex-1 p-2 border rounded-lg" value={item.productName} onChange={e => updateItem(index, 'productName', e.target.value)} />
                  <input required type="number" min="0.01" step="0.01" placeholder="Qté" className="w-24 p-2 border rounded-lg" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} />
                  <input required type="number" min="0" step="0.01" placeholder="Prix HT" className="w-32 p-2 border rounded-lg" value={item.unitPriceHT} onChange={e => updateItem(index, 'unitPriceHT', Number(e.target.value))} />
                  <select className="w-24 p-2 border rounded-lg" value={item.vatRate} onChange={e => updateItem(index, 'vatRate', Number(e.target.value))}>
                    <option value={0.20}>20%</option>
                    <option value={0.14}>14%</option>
                    <option value={0.10}>10%</option>
                    <option value={0}>0%</option>
                  </select>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItemRow(index)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Annuler</button>
            <button type="submit" className={`px-6 py-2.5 bg-${isLegal ? 'indigo-600' : 'emerald-600'} text-white font-bold rounded-xl hover:opacity-90 shadow-lg`}>
                Enregistrer Achat
            </button>
          </div>
        </form>
      )}

      {/* TABLE */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 font-bold tracking-widest animate-pulse">CHARGEMENT...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Date & Réf</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Fournisseur</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase">Type</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Total TTC</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{p.reference}</div>
                      <div className="text-xs text-slate-500">{new Date(p.issuedAt).toLocaleDateString('fr-MA')}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-700">{p.supplier?.name || p.supplierNameSnapshot}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-lg ${p.type === 'BON_COMMANDE' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-indigo-600">
                        {formatMAD(p.totalTTC)}
                    </td>
                    <td className="p-4 text-right">
                        <button 
                           onClick={() => setPrintingPurchase(p)} 
                           className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                           title="Imprimer"
                        >
                           <Printer size={18} />
                        </button>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium">Aucun achat enregistré.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RENDER THE PRINT MODAL */}
      {printingPurchase && (
          <PurchasePrint purchase={printingPurchase} onClose={() => setPrintingPurchase(null)} />
      )}
    </div>
  );
};