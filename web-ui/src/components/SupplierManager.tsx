import React, { useState, useEffect } from 'react';
import { Search, Plus, Truck, Trash2, Building2, Phone } from 'lucide-react';
import { SupplierService } from '../api/supplier'; 

interface SupplierManagerProps {
  mode: 'LEGAL' | 'INTERNAL';
}

export const SupplierManager = ({ mode }: SupplierManagerProps) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', ice: '', phone: '', email: '', rc: '', if: '' });

  // Dynamic Theme Logic
  const isLegal = mode === 'LEGAL';
  const themeColor = isLegal ? 'blue' : 'emerald';
  const labelText = isLegal ? 'Base de données légale' : 'Base de données interne (B)';

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      // Pass 'mode' to the service so it knows which endpoint to hit
      const res = await SupplierService.getAll(mode, { search });
      setSuppliers(res.data || res); 
    } catch (error) {
      console.error(`Erreur chargement fournisseurs (${mode}):`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search, mode]); // Refetch if mode switches

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await SupplierService.create(mode, formData);
      setShowForm(false);
      setFormData({ name: '', ice: '', phone: '', email: '', rc: '', if: '' });
      fetchSuppliers();
    } catch (error: any) {
      alert(error.response?.data?.error || "Erreur lors de la création.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce fournisseur ?')) {
      try {
        await SupplierService.delete(mode, id);
        fetchSuppliers();
      } catch (error) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl bg-${themeColor}-500/10 text-${themeColor}-600`}>
            <Truck size={28} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Fournisseurs {!isLegal && <span className="text-emerald-600">(Silo B)</span>}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{labelText}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2.5 bg-${isLegal ? 'blue-600' : 'emerald-600'} text-white font-bold rounded-xl hover:opacity-90 shadow-lg transition-all flex items-center gap-2`}
        >
          <Plus size={18} /> Nouveau Fournisseur
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Rechercher par nom, ICE, téléphone..." 
          className={`w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:border-${themeColor}-500 focus:ring-4 focus:ring-${themeColor}-500/10 transition-all`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* CREATE FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-4 duration-200">
          <h3 className="text-sm font-black text-slate-800 uppercase mb-4 border-b pb-2">
              {isLegal ? 'Informations Légales' : 'Détails Fournisseur Interne'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <input required type="text" placeholder="Nom de l'entreprise *" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input type="text" placeholder="ICE" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              value={formData.ice} onChange={e => setFormData({...formData, ice: e.target.value})} />
            <input type="text" placeholder="Téléphone" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <input type="text" placeholder="RC" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              value={formData.rc} onChange={e => setFormData({...formData, rc: e.target.value})} />
            <input type="text" placeholder="IF (Identifiant Fiscal)" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              value={formData.if} onChange={e => setFormData({...formData, if: e.target.value})} />
            <input type="email" placeholder="Email" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Annuler</button>
            <button type="submit" className={`px-6 py-2.5 bg-${isLegal ? 'blue-600' : 'emerald-600'} text-white font-bold rounded-xl hover:opacity-90 shadow-lg`}>
                Enregistrer
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
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Entreprise</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Identifiants (ICE/RC)</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><Building2 size={20} /></div>
                        <span className="font-bold text-slate-800">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">ICE: {supplier.ice || '-'}</span>
                        <span className="text-xs text-slate-500">RC: {supplier.rc || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400"/> {supplier.phone || '-'}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDelete(supplier.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">Aucun fournisseur trouvé.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};