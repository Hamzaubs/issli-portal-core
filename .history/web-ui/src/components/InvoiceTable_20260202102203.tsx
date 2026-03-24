// web-ui/src/components/InvoiceTable.tsx

// apps/web-ui/src/components/InvoiceTable.tsx

import React, { useEffect, useState, useRef } from 'react';

import axios from 'axios';

import { useReactToPrint } from 'react-to-print';

import { Printer, Ban, FileX, CheckCircle, Search } from 'lucide-react';

import { InvoicePrint } from './InvoicePrint';

export const InvoiceTable = ({ refresh }: { refresh: number }) => {

  const [invoices, setInvoices] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState(''); // 🔍 Search State

  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {

    const token = localStorage.getItem('marine_token');

    if(!token) return;

    axios.get('http://localhost:3000/api/legal/invoices', { headers: { Authorization: `Bearer ${token}` } })

      .then(res => setInvoices(res.data))

      .catch(console.error);

  }, [refresh]);

  const handleCancel = async (id: string) => {

      if(!confirm("Créer un Avoir et annuler cette facture ?")) return;

      const token = localStorage.getItem('marine_token');

      try {

          await axios.post(`http://localhost:3000/api/legal/invoices/${id}/cancel\`, {}, { headers: { Authorization: `Bearer ${token}` } });

          alert("✅ Avoir créé avec succès.");

          window.location.reload();

      } catch (e) { alert("Erreur création avoir"); }

  };

  const handlePrintRequest = (inv: any) => {

      setSelectedInvoice(inv);

      setShowPrintModal(true);

  };

  const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

  // 🔍 Search Filter Logic

  const filteredInvoices = invoices.filter(inv =>

    inv.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||

    inv.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||

    inv.totalTTC.toString().includes(searchTerm)

  );

  return (

    <>

      {/* --- HEADER WITH SEARCH --- */}

     

         

              {filteredInvoices.length} Documents trouvés

         

         

             

              <input

                type="text"

                placeholder="Rechercher facture..."

                className="pl-9 pr-4 py-2 text-sm border border-slate-200 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"

                value={searchTerm}

                onChange={(e) => setSearchTerm(e.target.value)}

              />

         

     

      {/* --- TABLEAU ÉCRAN --- */}

     

       

         

           

              Référence

              Date

              Client

              Total HT

              Total TTC

              État

              Actions

           

         

         

            {filteredInvoices.length === 0 ? (

                Aucune facture trouvée.

            ) : (

                filteredInvoices.map(inv => (

               

                    {inv.reference}

                    {new Date(inv.issuedAt).toLocaleDateString('fr-MA')}

                    {inv.client.name}

                    {formatMAD(inv.totalHT)}

                    {formatMAD(inv.totalTTC)}

                   

                        {inv.isCancelled || inv.reference.startsWith('AVOIR') ?

                            Avoir :

                            Payée

                        }

                   

                   

                        <button onClick={() => handlePrintRequest(inv)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Imprimer">

                        {!inv.isCancelled && !inv.reference.startsWith('AVOIR') && (

                            <button onClick={() => handleCancel(inv.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Annuler">

                        )}

                   

               

                ))

            )}

         

       

     

      {/* 🖨️ MODAL IMPRESSION (Reuses the Standardized Component) */}

      {showPrintModal && selectedInvoice && (

          <InvoicePrint invoice={selectedInvoice} onClose={() => setShowPrintModal(false)} />

      )}

    </>

  );

};