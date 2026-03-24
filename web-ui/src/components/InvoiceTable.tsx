// web-ui/src/components/InvoiceTable.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Printer, Ban, Search, FileCheck, AlertTriangle } from 'lucide-react';
import { InvoicePrint } from './InvoicePrint';

export const InvoiceTable = ({ refresh }: { refresh: number }) => {
  // 🛡️ RBAC: Security Check
  const currentUser = JSON.parse(localStorage.getItem('marine_user') || '{}');
  const isAdmin = currentUser.role === 'SUPER_ADMIN';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [avoirModal, setAvoirModal] = useState<{ isOpen: boolean, inv: any, returns: { [key: string]: number } }>({ isOpen: false, inv: null, returns: {} });

  useEffect(() => {
    const token = localStorage.getItem('marine_token');
    if(!token) return;

    axios.get('http://localhost:3000/api/legal/invoices', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setInvoices(res.data.data))
      .catch(console.error);
  }, [refresh]);

  const handlePrintRequest = (inv: any) => {
      setSelectedInvoice({ 
          ...inv, 
          paymentMode: inv.paymentMode || 'CRÉDIT' 
      });
      setShowPrintModal(true);
  };

  const openAvoirModal = async (inv: any) => {
      const token = localStorage.getItem('marine_token');
      try {
          const res = await axios.get(`http://localhost:3000/api/legal/invoices/${inv.id}`, { headers: { Authorization: `Bearer ${token}` } });
          const fullInv = res.data;
          
          const initialReturns: any = {};
          fullInv.items.forEach((item: any) => { initialReturns[item.id] = 0; });
          
          setAvoirModal({ isOpen: true, inv: fullInv, returns: initialReturns });
      } catch (e) { alert("Erreur chargement détails facture"); }
  };

  const submitPartialAvoir = async () => {
      const partialReturns = Object.keys(avoirModal.returns)
          .map(id => ({ id, returnQty: avoirModal.returns[id] }))
          .filter(item => item.returnQty > 0);

      if (partialReturns.length === 0) return alert("Veuillez sélectionner au moins un article à retourner.");

      if(!confirm("Générer l'Avoir avec les quantités sélectionnées ?")) return;

      const token = localStorage.getItem('marine_token');
      try {
          await axios.post(
              `http://localhost:3000/api/legal/invoices/${avoirModal.inv.id}/cancel`, 
              { partialReturns }, 
              { headers: { Authorization: `Bearer ${token}` } }
          );
          alert("✅ Avoir partiel créé avec succès.");
          window.location.reload();
      } catch (error: any) { 
          alert("Erreur: " + (error.response?.data?.error || "Serveur")); 
      }
  };

  const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

  const filteredInvoices = invoices.filter(inv =>
    inv.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.totalTTC?.toString().includes(searchTerm)
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
         <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
             <span className="bg-white px-2 py-1 rounded shadow-sm border border-slate-200">{filteredInvoices.length}</span>
             <span>Documents trouvés</span>
         </div>
         <div className="relative">
             <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
             <input
                type="text"
                placeholder="Rechercher facture..."
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
         </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
            <tr>
              <th className="p-4">Référence</th>
              <th className="p-4">Date</th>
              <th className="p-4">Client</th>
              <th className="p-4 text-right">Total HT</th>
              <th className="p-4 text-right">Total TTC</th>
              <th className="p-4 text-center">État</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {filteredInvoices.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">Aucune facture trouvée.</td></tr>
            ) : (
                filteredInvoices.map(inv => {
                    const isCancelled = inv.status === 'ANNULEE' || inv.status === 'CANCELLED' || inv.status === 'AVOIR_EMIS';
                    const isPartialAvoir = inv.status === 'AVOIR_PARTIEL';
                    const isCredit = inv.type === 'AVOIR';
                    const isPaid = inv.status === 'PAYEE' || inv.status === 'PAID';

                    return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-blue-900">{inv.reference}</td>
                            <td className="p-4 font-mono text-slate-500 text-xs">{new Date(inv.issuedAt).toLocaleDateString('fr-MA')}</td>
                            <td className="p-4 font-bold">{inv.client?.name || 'Inconnu'}</td>
                            <td className="p-4 text-right font-mono">{formatMAD(inv.totalHT)}</td>
                            <td className="p-4 text-right font-black">{formatMAD(inv.totalTTC)}</td>
                            <td className="p-4 text-center">
                                {isCancelled ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold uppercase"><Ban size={12}/> Annulée</span>
                                ) : isPartialAvoir ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold uppercase"><AlertTriangle size={12}/> Avoir Partiel</span>
                                ) : isCredit ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold uppercase"><AlertTriangle size={12}/> Avoir</span>
                                ) : isPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold uppercase"><FileCheck size={12}/> Payée</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">Impayée</span>
                                )}
                            </td>
                            <td className="p-4 flex justify-center gap-2">
                                <button onClick={() => handlePrintRequest(inv)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Imprimer">
                                    <Printer size={18}/>
                                </button>
                                {/* 🛡️ RBAC: Only admin can void/return */}
                                {!isCancelled && !isCredit && isAdmin && (
                                    <button onClick={() => openAvoirModal(inv)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Créer un Avoir (Total ou Partiel)">
                                        <Ban size={18}/>
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ PARTIAL AVOIR MODAL */}
      {avoirModal.isOpen && avoirModal.inv && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6 shrink-0">
                      <h2 className="text-xl font-black text-slate-800">Générer un Avoir</h2>
                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-mono text-sm">{avoirModal.inv.reference}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mb-6">
                      <p className="text-sm font-bold text-slate-500 mb-4 uppercase">Sélectionnez les quantités à retourner :</p>
                      <div className="space-y-3">
                          {avoirModal.inv.items.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                                  <div>
                                      <p className="font-bold text-slate-800">{item.productName}</p>
                                      <p className="text-xs text-slate-500">Acheté: {item.quantity} u | Prix unitaire: {formatMAD(item.unitPriceHT)} HT</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <span className="text-xs font-bold text-slate-400 uppercase">Retour:</span>
                                      <input 
                                          type="number" min="0" max={item.quantity} 
                                          value={avoirModal.returns[item.id]}
                                          onChange={e => setAvoirModal(prev => ({
                                              ...prev, returns: { ...prev.returns, [item.id]: Number(e.target.value) }
                                          }))}
                                          className="w-20 bg-white border border-slate-300 rounded-lg p-2 font-bold text-center text-slate-800 outline-none focus:border-red-500"
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="flex gap-3 shrink-0">
                      <button onClick={() => setAvoirModal({isOpen: false, inv: null, returns: {}})} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Annuler</button>
                      <button onClick={submitPartialAvoir} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                          <Ban size={18}/> Confirmer Avoir
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showPrintModal && selectedInvoice && (
          <InvoicePrint invoice={selectedInvoice} onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
};