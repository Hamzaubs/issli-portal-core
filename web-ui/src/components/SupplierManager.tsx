// web-ui/src/components/SupplierManager.tsx
import React, { useState, useEffect } from 'react';
import { Search, Plus, Truck, Trash2, Building2, Phone, CreditCard, XCircle, CheckCircle, History, FileText, Printer } from 'lucide-react';
import { SupplierService } from '../api/supplier'; 
import client from '../api/client';
import { SupplierStatementPrint } from './SupplierStatementPrint'; 

interface SupplierManagerProps {
  mode: 'LEGAL' | 'INTERNAL';
}

export const SupplierManager = ({ mode }: SupplierManagerProps) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', ice: '', phone: '', email: '', rc: '', if: '' });

  const [paymentModal, setPaymentModal] = useState<{ 
      isOpen: boolean; supplier: any; amount: string; method: string; ref: string; note: string 
  }>({ isOpen: false, supplier: null, amount: '', method: 'VIREMENT', ref: '', note: '' });

  const [statementModal, setStatementModal] = useState<{
      isOpen: boolean; supplier: any; statement: any[]; loading: boolean;
  }>({ isOpen: false, supplier: null, statement: [], loading: false });

  const [printingStatement, setPrintingStatement] = useState(false);

  const isLegal = mode === 'LEGAL';
  const themeColor = isLegal ? 'indigo' : 'emerald';
  const labelText = isLegal ? 'Base de données légale' : 'Base de données (Stock Global)';

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await SupplierService.getAll(mode, { search });
      setSuppliers(res.data || res); 
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchSuppliers(); }, [search, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await SupplierService.create(mode, formData);
      setShowForm(false);
      setFormData({ name: '', ice: '', phone: '', email: '', rc: '', if: '' });
      fetchSuppliers();
    } catch (error: any) { alert(error.response?.data?.error || "Erreur lors de la création."); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action est irréversible.')) {
      try { 
          await SupplierService.delete(mode, id); 
          alert("✅ Fournisseur supprimé avec succès.");
          fetchSuppliers(); 
      } catch (error: any) { 
          alert(error.response?.data?.error || "Erreur inattendue lors de la suppression."); 
      }
    }
  };

  const submitPayment = async () => {
      const rawAmt = Number(paymentModal.amount);
      if (!rawAmt || rawAmt <= 0) return alert("Montant invalide");

      const payAmtCents = Math.round(rawAmt * 100);
      const balanceCents = Math.round(Number(paymentModal.supplier.balance || 0) * 100);

      if (payAmtCents > balanceCents) {
          return alert(`Impossible ! Vous essayez de payer ${formatMAD(payAmtCents / 100)}, mais la dette actuelle n'est que de ${formatMAD(balanceCents / 100)}.`);
      }

      try {
          await client.post(`/internal/suppliers/${paymentModal.supplier.id}/payment`, {
              amount: payAmtCents / 100, 
              method: paymentModal.method, 
              reference: paymentModal.ref, 
              note: paymentModal.note
          });
          alert("✅ Paiement enregistré avec succès !");
          setPaymentModal(p => ({ ...p, isOpen: false }));
          fetchSuppliers();
      } catch (error: any) { alert(error.response?.data?.error || "Erreur lors du paiement."); }
  };

  const openStatement = async (supplier: any) => {
      setStatementModal({ isOpen: true, supplier, statement: [], loading: true });
      try {
          const res = await client.get(`/internal/suppliers/${supplier.id}/statement`);
          setStatementModal({ isOpen: true, supplier, statement: res.data.statement, loading: false });
      } catch (error: any) {
          console.error("Frontend Statement Error:", error);
          alert(error.response?.data?.error || "Erreur de connexion au serveur.");
          setStatementModal(p => ({ ...p, isOpen: false }));
      }
  };

  const formatMAD = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(amount));

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-full flex flex-col relative">
      
      <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-${themeColor}-500/10 text-${themeColor}-600 shadow-sm`}>
            <Truck size={28} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Fournisseurs {!isLegal && <span className="text-emerald-600">(Stock Global)</span>}</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{labelText}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={`px-5 py-3 bg-${isLegal ? 'indigo-600' : 'emerald-600'} text-white font-black uppercase text-xs tracking-wider rounded-xl hover:opacity-90 shadow-lg transition-all flex items-center gap-2 active:scale-95`}>
          <Plus size={18} /> Nouveau Fournisseur
        </button>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" placeholder="Rechercher par nom d'entreprise, ICE, ou téléphone..." 
          className={`w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 shadow-sm focus:outline-none focus:border-${themeColor}-500 transition-all`}
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner mb-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <input required type="text" placeholder="Raison Sociale *" className="p-4 bg-white rounded-xl outline-none border border-slate-200 focus:border-blue-500 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input type="text" placeholder="ICE" className="p-4 bg-white rounded-xl outline-none border border-slate-200 focus:border-blue-500 font-bold" value={formData.ice} onChange={e => setFormData({...formData, ice: e.target.value})} />
              <input type="text" placeholder="Téléphone" className="p-4 bg-white rounded-xl outline-none border border-slate-200 focus:border-blue-500 font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
           </div>
           <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setShowForm(false)} className="px-8 py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
            <button type="submit" className={`px-8 py-3 bg-${isLegal ? 'indigo-600' : 'emerald-600'} text-white font-bold uppercase text-xs rounded-xl shadow-lg`}><CheckCircle size={16} className="inline mr-2"/> Enregistrer</button>
          </div>
        </form>
      )}

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? <div className="flex-1 flex items-center justify-center animate-pulse text-slate-400 font-bold">CHARGEMENT...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Entreprise</th>
                  {!isLegal && <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Finances (Dettes)</th>}
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Contact</th>
                  <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200"><Building2 size={24} /></div>
                        <div className="flex flex-col">
                            <span className="font-black text-slate-800 text-lg">{supplier.name}</span>
                            <span className="text-xs font-bold text-slate-400 mt-1 uppercase">ICE: {supplier.ice || 'NON RENSEIGNÉ'}</span>
                        </div>
                      </div>
                    </td>
                    {!isLegal && (
                        <td className="p-5">
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Volume: {formatMAD(supplier.totalPurchased || 0)}</span>
                                <span className={`text-sm font-black mt-1 ${supplier.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    Solde dû: {formatMAD(supplier.balance || 0)}
                                </span>
                            </div>
                        </td>
                    )}
                    <td className="p-5">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 w-max px-3 py-1.5 rounded-lg shadow-sm">
                        <Phone size={14} className="text-slate-400"/> {supplier.phone || 'Aucun numéro'}
                      </div>
                    </td>
                    <td className="p-5 text-right flex items-center justify-end gap-3">
                      {!isLegal && (
                          <>
                              <button onClick={() => openStatement(supplier)} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-2 opacity-0 group-hover:opacity-100">
                                  <History size={16}/> Historique
                              </button>
                              {supplier.balance > 0 && (
                                  <button onClick={() => setPaymentModal({ isOpen: true, supplier, amount: '', method: 'VIREMENT', ref: '', note: '' })} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-2 opacity-0 group-hover:opacity-100 border border-red-200">
                                      <CreditCard size={16}/> Régler Dette
                                  </button>
                              )}
                          </>
                      )}
                      <button onClick={() => handleDelete(supplier.id)} className="p-2.5 text-slate-300 hover:text-white hover:bg-red-500 rounded-lg transition-colors border border-transparent hover:border-red-600">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statementModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                      <div>
                          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><FileText className="text-emerald-500" size={24}/> Relevé Fournisseur</h2>
                          <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">{statementModal.supplier?.name}</p>
                      </div>
                      <div className="flex items-center gap-4">
                          {!statementModal.loading && (
                              <button onClick={() => setPrintingStatement(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-bold rounded-lg transition-colors text-sm">
                                  <Printer size={18}/> Imprimer PDF
                              </button>
                          )}
                          <button onClick={() => setStatementModal({...statementModal, isOpen: false})}><XCircle className="text-slate-400 hover:text-slate-600 transition-colors" size={28}/></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                      {statementModal.loading ? (
                          <div className="flex items-center justify-center h-40 text-slate-400 font-bold tracking-widest animate-pulse">GÉNÉRATION DU RELEVÉ...</div>
                      ) : (
                          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                                      <tr>
                                          <th className="p-4">Date</th>
                                          <th className="p-4">Opération & Réf</th>
                                          <th className="p-4 text-right text-emerald-600">Débit (Payé)</th>
                                          <th className="p-4 text-right text-red-500">Crédit (Acheté)</th>
                                          <th className="p-4 text-right bg-slate-200 text-slate-800">Solde (Dette)</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono">
                                      {statementModal.statement.length === 0 ? (
                                          <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-sans font-bold">Aucune transaction enregistrée.</td></tr>
                                      ) : statementModal.statement.map((item, index) => (
                                          <tr key={item.id || index} className="hover:bg-slate-50">
                                              <td className="p-4 font-bold text-slate-600">{new Date(item.date).toLocaleDateString('fr-MA')}</td>
                                              <td className="p-4">
                                                  <div className="font-bold text-slate-800">{item.ref}</div>
                                                  <div className="text-[10px] text-slate-500 font-sans uppercase tracking-widest mt-1">{item.type.replace('_', ' ')}</div>
                                              </td>
                                              <td className="p-4 text-right font-black text-emerald-500">{item.debit > 0 ? formatMAD(item.debit) : '-'}</td>
                                              <td className="p-4 text-right font-black text-red-400">{item.credit > 0 ? formatMAD(item.credit) : '-'}</td>
                                              <td className="p-4 text-right font-black bg-slate-50 text-slate-900 border-l border-slate-100">
                                                  {formatMAD(item.balance)}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>
                  
                  {!statementModal.loading && (
                      <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Solde Dû Actuel</p>
                          <p className="text-3xl font-black text-red-500">
                              {formatMAD(statementModal.statement[statementModal.statement.length - 1]?.balance || 0)}
                          </p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {paymentModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 border border-slate-200">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                      <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><CreditCard className="text-red-500"/> Régler Dette</h2>
                      <button onClick={() => setPaymentModal({...paymentModal, isOpen: false})}><XCircle className="text-slate-400 hover:text-slate-600 transition-colors"/></button>
                  </div>
                  <div className="mb-6 p-5 bg-red-50 rounded-2xl border border-red-100 text-center shadow-inner">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Solde actuel dû à {paymentModal.supplier?.name}</p>
                      <p className="text-3xl font-black text-red-600">{formatMAD(paymentModal.supplier?.balance || 0)}</p>
                  </div>
                  <div className="space-y-4 mb-8">
                      <input type="number" step="0.01" placeholder="Montant du règlement" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg outline-none focus:border-red-500" value={paymentModal.amount} onChange={e => setPaymentModal({...paymentModal, amount: e.target.value})} />
                      <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500" value={paymentModal.method} onChange={e => setPaymentModal({...paymentModal, method: e.target.value})}>
                          <option value="VIREMENT">Virement</option><option value="CHEQUE">Chèque</option><option value="CASH">Espèces</option>
                      </select>
                  </div>
                  <button onClick={submitPayment} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"><CheckCircle size={18}/> Confirmer Paiement</button>
              </div>
          </div>
      )}

      {printingStatement && statementModal.supplier && (
          <SupplierStatementPrint 
              supplier={statementModal.supplier} 
              statement={statementModal.statement} 
              onClose={() => setPrintingStatement(false)} 
          />
      )}
    </div>
  );
};