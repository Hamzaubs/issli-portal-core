// web-ui/src/components/StockTable.tsx
import React, { useEffect, useState } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import client from '../api/client';
import { ProductForm } from './ProductForm'; // Assuming Stock B uses ProductForm or similar

export const StockTable = ({ refreshTrigger }: { refreshTrigger?: number }) => {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<any>(null);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            // STOCK B uses the internal endpoint
            const res = await client.get('/internal/products');
            setProducts(res.data);
        } catch (error) {
            console.error("Erreur chargement STOCK B:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, [refreshTrigger]);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Supprimer ce produit du STOCK B ?")) return;
        try {
            await client.delete(`/internal/products/${id}`);
            fetchProducts();
        } catch (err) { alert("Impossible de supprimer."); }
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
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider">
                        STOCK B : {filtered.length} Références
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
                        {loading ? <tr><td colSpan={5} className="p-8 text-center">Chargement STOCK B...</td></tr> : 
                         filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun produit trouvé.</td></tr> :
                         filtered.map(p => (
                            <tr key={p.id} className="hover:bg-emerald-50/50 transition-colors group">
                                <td className="p-4">
                                    <div className="font-bold text-slate-700">{p.name}</div>
                                    <div className="text-[10px] font-mono text-emerald-600 bg-emerald-50 inline-block px-1 rounded border border-emerald-100 mt-1">
                                        {p.internalSku || 'NO-SKU'}
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.quantity > 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {p.quantity} U
                                    </span>
                                </td>
                                <td className="p-4 text-right font-mono text-slate-400">{formatMAD(p.purchaseCost)}</td>
                                <td className="p-4 text-right font-mono font-bold text-slate-800">{formatMAD(p.sellingPrice)}</td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingProduct(p)} className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded"><Trash2 size={16}/></button>
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