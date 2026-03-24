// web-ui/src/components/StockTableLegal.tsx
import React, { useEffect, useState } from 'react';
import { Search, Edit2, Trash2, History } from 'lucide-react';
import client from '../api/client';
import { AssetForm } from './AssetForm';
import { ProductHistoryModal } from './ProductHistoryModal'; // ✅ IMPORT

export const StockTableLegal = ({ refreshTrigger }: { refreshTrigger?: number }) => {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal States
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [historyId, setHistoryId] = useState<string | null>(null); // ✅ NEW STATE

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await client.get('/legal/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Erreur chargement stock:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, [refreshTrigger]);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Supprimer ce produit ?")) return;
        try {
            await client.delete(`/legal/products/${id}`);
            fetchProducts();
        } catch (err: any) { 
            // Better Error Handling
            alert(err.response?.data?.error || "Impossible de supprimer."); 
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        STOCK A : {filtered.length} Références
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="p-4">Désignation</th>
                            <th className="p-4 text-center">Stock</th>
                            <th className="p-4 text-right">Prix Achat</th>
                            <th className="p-4 text-right">Prix Vente</th>
                            <th className="p-4 text-center">TVA</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <tr><td colSpan={6} className="p-8 text-center">Chargement...</td></tr> : 
                         filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun produit trouvé.</td></tr> :
                         filtered.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="p-4">
                                    <div className="font-bold text-slate-700">{p.name}</div>
                                    <div className="text-[10px] font-mono text-slate-400">{p.serialNumber}</div>
                                    {p.technicalSpecs && <div className="text-[10px] text-slate-500 italic mt-1">{p.technicalSpecs}</div>}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.quantity > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {p.quantity} {p.measureUnit}
                                    </span>
                                </td>
                                <td className="p-4 text-right font-mono text-slate-400">{formatMAD(p.purchaseCost)}</td>
                                <td className="p-4 text-right font-mono font-bold text-slate-800">{formatMAD(p.priceHT)}</td>
                                <td className="p-4 text-center">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.vatRate === 0.20 ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                                        {(p.vatRate * 100).toFixed(0)}%
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* ✅ HISTORY BUTTON */}
                                        <button onClick={() => setHistoryId(p.id)} className="p-1.5 hover:bg-purple-100 text-purple-600 rounded" title="Voir Historique">
                                            <History size={16}/>
                                        </button>
                                        
                                        <button onClick={() => setEditingProduct(p)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded" title="Modifier">
                                            <Edit2 size={16}/>
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded" title="Supprimer">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODALS */}
            {editingProduct && (
                <AssetForm 
                    initialData={editingProduct} 
                    onCancel={() => setEditingProduct(null)} 
                    onSuccess={() => { setEditingProduct(null); fetchProducts(); }} 
                />
            )}

            {/* ✅ HISTORY MODAL */}
            {historyId && (
                <ProductHistoryModal 
                    productId={historyId} 
                    onClose={() => setHistoryId(null)} 
                />
            )}
        </div>
    );
};