import React, { useEffect, useState } from 'react';
import { Search, Edit2, Trash2, AlertCircle, History } from 'lucide-react';
import client from '../api/client';
import { ProductForm } from './ProductForm';

// ✅ Strict Type Definition (Matches InternalController output)
interface InternalProduct {
  id: string;
  name: string;
  internalSku: string;
  quantity: number;
  purchaseCost: number; 
  sellingPrice: number; 
  measureUnit: string;
  _count?: {
    movements: number;
  };
}

export const StockTable = ({ refreshTrigger }: { refreshTrigger?: number }) => {
    const [products, setProducts] = useState<InternalProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<InternalProduct | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await client.get('/internal/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Erreur chargement STOCK B:", error);
            setError("Impossible de charger le stock interne.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, [refreshTrigger]);

    // ✅ Safety Protocol: Prevent deletion if history exists
    const handleDelete = async (p: InternalProduct) => {
        if (p._count?.movements && p._count.movements > 0) {
            alert(`⛔ ACTION REFUSÉE\n\nImpossible de supprimer "${p.name}" car il possède ${p._count.movements} mouvements d'historique.\n\nSolution : Utilisez une "Correction de Stock" pour mettre la quantité à zéro.`);
            return;
        }

        if (!window.confirm(`Supprimer définitivement "${p.name}" ?`)) return;
        
        try {
            await client.delete(`/internal/products/${p.id}`);
            fetchProducts();
        } catch (err) { 
            alert("Erreur technique lors de la suppression."); 
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.internalSku && p.internalSku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-emerald-100">
            {/* Toolbar */}
            <div className="p-4 border-b border-emerald-50 bg-emerald-50/30 flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input 
                        type="text" 
                        placeholder="Rechercher (Nom, SKU)..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-100"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4">
                     {error && <div className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12}/> {error}</div>}
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">
                            STOCK B : {filtered.length} Références
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="p-4">Désignation / SKU</th>
                            <th className="p-4 text-center">Stock Physique</th>
                            <th className="p-4 text-right">Coût Achat</th>
                            <th className="p-4 text-right">Prix Vente</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? 
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Chargement...</td></tr> : 
                        filtered.length === 0 ? 
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun produit trouvé.</td></tr> :
                        filtered.map(p => (
                            <tr key={p.id} className="hover:bg-emerald-50/50 transition-colors group">
                                <td className="p-4">
                                    <div className="font-bold text-slate-700">{p.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100">
                                            {p.internalSku || 'NO-SKU'}
                                        </span>
                                        {/* Visual Indicator for Audit Trail */}
                                        {p._count?.movements ? (
                                             <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title={`${p._count.movements} Mouvements enregistrés`}>
                                                <History size={10}/> {p._count.movements}
                                             </span>
                                        ) : null}
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                                        p.quantity > 5 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                                        p.quantity > 0 ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                        'bg-red-100 text-red-700 border-red-200'
                                    }`}>
                                        {p.quantity} {p.measureUnit || 'U'}
                                    </span>
                                </td>
                                <td className="p-4 text-right font-mono text-slate-400">{formatMAD(p.purchaseCost)}</td>
                                <td className="p-4 text-right font-mono font-bold text-slate-800">{formatMAD(p.sellingPrice)}</td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => setEditingProduct(p)} 
                                            className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(p)} 
                                            className={`p-1.5 rounded transition-colors ${
                                                p._count?.movements && p._count.movements > 0 
                                                ? 'hover:bg-slate-100 text-slate-300 cursor-not-allowed' 
                                                : 'hover:bg-red-100 text-red-600'
                                            }`}
                                            title={p._count?.movements && p._count.movements > 0 ? "Suppression interdite (Historique existant)" : "Supprimer"}
                                            disabled={!!(p._count?.movements && p._count.movements > 0)}
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingProduct && (
                <ProductForm 
                    initialData={editingProduct} 
                    onCancel={() => setEditingProduct(null)} 
                    onSuccess={() => { setEditingProduct(null); fetchProducts(); }} 
                />
            )}
        </div>
    );
};