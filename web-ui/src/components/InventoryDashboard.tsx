import React, { useState, useEffect } from 'react';
import { 
    Save, RotateCcw, Search, Package, 
    CheckCircle, Loader2, AlertCircle, TrendingUp, TrendingDown 
} from 'lucide-react';
import client from '../api/client';

export const InventoryDashboard: React.FC = () => {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOnlyDiff, setFilterOnlyDiff] = useState(false);
    
    // Tracks the "Real Count" entered by the user: { [productId]: number }
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await client.get('/internal/products');
            setProducts(res.data);
            
            // Initialize the inputs with current system quantity
            const initialCounts: Record<string, number> = {};
            res.data.forEach((p: any) => {
                initialCounts[p.id] = p.quantity;
            });
            setCounts(initialCounts);
        } catch (e) {
            console.error("Failed to load inventory:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCountChange = (id: string, value: string) => {
        const val = value === '' ? 0 : parseInt(value);
        setCounts(prev => ({ ...prev, [id]: val }));
    };

    const handleValidate = async () => {
        const adjustments = products
            .map(p => ({
                productId: p.id,
                theoreticalQuantity: p.quantity,
                realQuantity: counts[p.id] ?? p.quantity,
                name: p.name
            }))
            .filter(item => item.realQuantity !== item.theoreticalQuantity);

        if (adjustments.length === 0) {
            alert("Aucun écart détecté. Rien à corriger !");
            return;
        }

        if (!confirm(`Confirmer la correction de ${adjustments.length} articles ?\nCette action est définitive.`)) return;

        setIsSaving(true);
        try {
            await client.post('/internal/inventory/adjust', {
                adjustments,
                reason: "Inventaire de contrôle"
            });
            alert("✅ Stock mis à jour avec succès !");
            loadData(); // Refresh theoretical numbers
        } catch (e) {
            alert("Erreur lors de la mise à jour de l'inventaire.");
        } finally {
            setIsSaving(false);
        }
    };

    const formatMAD = (n: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n);

    // Filtering logic
    const displayedProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.internalSku.toLowerCase().includes(searchTerm.toLowerCase());
        const real = counts[p.id] ?? p.quantity;
        const hasDiff = real !== p.quantity;
        
        if (filterOnlyDiff) return matchesSearch && hasDiff;
        return matchesSearch;
    });

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center p-20 text-slate-400">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-bold animate-pulse">Chargement de la base de stock...</p>
        </div>
    );

    return (
        <div className="p-8 max-w-[1400px] mx-auto min-h-screen bg-slate-50">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <Package className="text-purple-600" size={32} />
                        VÉRIFICATION DE STOCK
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Comparez le stock physique avec le stock informatique.
                    </p>
                </div>
                
                <button 
                    onClick={handleValidate}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-purple-200 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    VALIDER LES CORRECTIONS
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Chercher par nom ou SKU..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <button 
                    onClick={() => setFilterOnlyDiff(!filterOnlyDiff)}
                    className={`px-6 py-3 rounded-xl font-bold transition-all border-2 ${
                        filterOnlyDiff 
                        ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' 
                        : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
                    }`}
                >
                    {filterOnlyDiff ? 'Affichage: Écarts seulement' : 'Affichage: Tout'}
                </button>

                <button onClick={loadData} className="p-3 text-slate-400 hover:text-purple-600 transition-colors">
                    <RotateCcw size={20} />
                </button>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900 text-white text-[10px] uppercase tracking-widest font-black">
                        <tr>
                            <th className="p-5">Information Produit</th>
                            <th className="p-5 text-center">Théorique (Système)</th>
                            <th className="p-5 text-center bg-purple-900">Physique (Réel)</th>
                            <th className="p-5 text-center">Écart</th>
                            <th className="p-5 text-right">Impact Valeur</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayedProducts.map(p => {
                            const realCount = counts[p.id] ?? p.quantity;
                            const diff = realCount - p.quantity;
                            const valueImpact = diff * p.purchaseCost;

                            return (
                                <tr key={p.id} className={`transition-colors ${diff !== 0 ? 'bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                                    <td className="p-5">
                                        <div className="font-bold text-slate-800">{p.name}</div>
                                        <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-tighter">SKU: {p.internalSku}</div>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className="inline-block px-3 py-1 bg-slate-100 rounded-lg font-black text-slate-600 min-w-[60px]">
                                            {p.quantity}
                                        </span>
                                    </td>
                                    <td className="p-5 text-center bg-purple-50/30">
                                        <div className="flex items-center justify-center gap-3">
                                            <button 
                                                onClick={() => handleCountChange(p.id, (realCount - 1).toString())}
                                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-purple-100 hover:text-purple-600 transition-colors"
                                            >-</button>
                                            <input 
                                                type="number" 
                                                className="w-20 text-center font-black text-lg bg-transparent border-b-2 border-purple-200 focus:border-purple-600 outline-none"
                                                value={realCount}
                                                onChange={(e) => handleCountChange(p.id, e.target.value)}
                                            />
                                            <button 
                                                onClick={() => handleCountChange(p.id, (realCount + 1).toString())}
                                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-purple-100 hover:text-purple-600 transition-colors"
                                            >+</button>
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        {diff === 0 ? (
                                            <span className="text-slate-300 font-bold">-</span>
                                        ) : (
                                            <div className={`flex items-center justify-center gap-1 font-black ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {diff > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                                {diff > 0 ? '+' : ''}{diff}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5 text-right font-bold text-slate-400">
                                        {diff !== 0 && (
                                            <span className={diff > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                {formatMAD(valueImpact)}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                {displayedProducts.length === 0 && (
                    <div className="p-20 text-center text-slate-300 flex flex-col items-center">
                        <AlertCircle size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">Aucun article ne correspond à votre recherche.</p>
                    </div>
                )}
            </div>
            
            <div className="mt-6 text-[10px] text-slate-400 uppercase font-bold tracking-widest text-center">
                Marine Ops Framework - Truth Engine v4.0
            </div>
        </div>
    );
};