// web-ui/src/components/ProductForm.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Package, Ruler, Weight, Droplets, Box, Tag, FileText, AlertCircle, Calculator } from 'lucide-react';
import client from '../api/client';

interface Props {
    initialData?: any; 
    onCancel: () => void;
    onSuccess: () => void;
}

export const ProductForm: React.FC<Props> = ({ initialData, onCancel, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ BIG DATA SAFETY & TVA ENGINE: Strings prevent floating point UI glitches during typing
    const [formData, setFormData] = useState({
        name: '',
        internalSku: '',
        purchaseCost: '',  
        priceHT: '',       
        vatRate: '0.20',   // Default 20%
        priceTTC: '',      
        quantity: '',      
        measureUnit: 'UNIT',
        technicalSpecs: ''
    });

    // ✅ Load Initial Data (Map backend Cent-math values to UI strings)
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                internalSku: initialData.internalSku || '',
                purchaseCost: initialData.purchaseCost?.toString() || '',
                priceHT: initialData.priceHT?.toString() || '',
                vatRate: initialData.vatRate?.toString() || '0.20',
                priceTTC: initialData.priceTTC?.toString() || '',
                quantity: initialData.quantity?.toString() || '',
                measureUnit: initialData.measureUnit || 'UNIT',
                technicalSpecs: initialData.technicalSpecs || ''
            });
        }
    }, [initialData]);

    // ========================================================================
    // 🧮 STRICT CENT-BASED BIDIRECTIONAL MATH ENGINE (HT <-> TTC)
    // ========================================================================
    const handleHTChange = (val: string) => {
        const ht = parseFloat(val) || 0;
        const vat = parseFloat(formData.vatRate) || 0;
        // Strict cent-math prevents 19.999999 drift
        const ttc = (Math.round(ht * (1 + vat) * 100) / 100).toFixed(2);
        setFormData(prev => ({ ...prev, priceHT: val, priceTTC: val === '' ? '' : ttc }));
    };

    const handleTTCChange = (val: string) => {
        const ttc = parseFloat(val) || 0;
        const vat = parseFloat(formData.vatRate) || 0;
        const ht = (Math.round((ttc / (1 + vat)) * 100) / 100).toFixed(2);
        setFormData(prev => ({ ...prev, priceTTC: val, priceHT: val === '' ? '' : ht }));
    };

    const handleVatChange = (val: string) => {
        const vat = parseFloat(val) || 0;
        const ht = parseFloat(formData.priceHT) || 0;
        const ttc = (Math.round(ht * (1 + vat) * 100) / 100).toFixed(2);
        setFormData(prev => ({ ...prev, vatRate: val, priceTTC: formData.priceHT === '' ? '' : ttc }));
    };

    // ========================================================================
    // 🚀 SUBMISSION HANDLER
    // ========================================================================
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const cost = parseFloat(formData.purchaseCost) || 0;
        const ht = parseFloat(formData.priceHT) || 0;
        const vat = parseFloat(formData.vatRate) || 0;
        const ttc = parseFloat(formData.priceTTC) || 0;
        const qty = parseInt(formData.quantity) || 0;

        if (cost < 0 || ht < 0) {
            setError("Les prix ne peuvent pas être négatifs.");
            setLoading(false);
            return;
        }

        // 🛡️ STRICT PAYLOAD ALIGNMENT: We explicitly send priceTTC
        const payload = {
            ...formData,
            purchaseCost: Math.round(cost * 100) / 100,
            priceHT: Math.round(ht * 100) / 100,
            vatRate: vat,
            priceTTC: Math.round(ttc * 100) / 100, // Explicit TTC transmission
            quantity: qty
        };

        try {
            if (initialData && initialData.id) {
                await client.put(`/internal/products/${initialData.id}`, payload);
            } else {
                await client.post('/internal/products', payload);
            }
            onSuccess();
        } catch (error: any) {
            console.error(error);
            setError(error.response?.data?.error || "Erreur de connexion serveur");
        } finally {
            setLoading(false);
        }
    };

    const getUnitLabel = () => {
        switch (formData.measureUnit) {
            case 'KG': return 'au Kilogramme';
            case 'M': return 'au Mètre';
            case 'L': return 'au Litre';
            default: return 'Unitaire';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="p-6 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <div className="p-2 bg-emerald-500 rounded-lg text-white shadow-lg shadow-emerald-200">
                                <Package size={24}/>
                            </div>
                            {initialData ? 'Modifier le Produit' : 'Nouveau Produit'}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1 font-medium pl-1">
                            Gestion du <span className="font-bold text-emerald-600">STOCK B</span>
                        </p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="text-slate-400 hover:text-slate-700"/>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                    
                    {/* UNIT TYPE SELECTOR */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Type d'Unité</label>
                        <div className="grid grid-cols-4 gap-4">
                            {[
                                { id: 'UNIT', label: 'Unité (U)', icon: Box, color: 'blue' },
                                { id: 'KG', label: 'Poids (KG)', icon: Weight, color: 'orange' },
                                { id: 'M', label: 'Longueur (M)', icon: Ruler, color: 'purple' },
                                { id: 'L', label: 'Volume (L)', icon: Droplets, color: 'cyan' }
                            ].map((type) => (
                                <button
                                    key={type.id} type="button"
                                    onClick={() => setFormData({ ...formData, measureUnit: type.id })}
                                    className={`relative p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all duration-200 ${
                                        formData.measureUnit === type.id
                                            ? `border-${type.color}-500 bg-${type.color}-50 text-${type.color}-700 shadow-md transform scale-105`
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <type.icon size={28} strokeWidth={formData.measureUnit === type.id ? 2.5 : 1.5} />
                                    <span className="font-bold text-xs">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* INTERNAL FIELDS: SKU & Cost */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Référence (SKU)</label>
                            <div className="relative">
                                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                                <input required type="text" placeholder="REF-001" 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-xl font-mono text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                                    value={formData.internalSku} onChange={e => setFormData({...formData, internalSku: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Désignation</label>
                            <input required type="text" placeholder="Ex: Huile Moteur" 
                                className="w-full px-5 py-4 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* 💰 FINANCIAL ENGINE SECTION */}
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-6">
                        
                        {/* Row 1: Stock & Achat */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Coût d'Achat Réel (HT/TTC confondu)</label>
                                <input required type="number" min="0" step="0.01"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-400"
                                    value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Stock Physique Actuel</label>
                                <input type="number" min="0"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"
                                    value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Row 2: Vente (The TVA Engine) */}
                        <div className="bg-white p-5 rounded-xl border-2 border-emerald-100 shadow-sm relative">
                            <div className="absolute -top-3 left-4 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                                <Calculator size={12}/> Calculatrice de Vente
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase mb-2 block">Prix Vente HT</label>
                                    <input required type="number" min="0" step="0.01"
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white"
                                        value={formData.priceHT} onChange={e => handleHTChange(e.target.value)} placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400 uppercase mb-2 block">Taux TVA</label>
                                    <select 
                                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                                        value={formData.vatRate} onChange={e => handleVatChange(e.target.value)}
                                    >
                                        <option value="0">0% (Exonéré)</option>
                                        <option value="0.10">10%</option>
                                        <option value="0.14">14%</option>
                                        <option value="0.20">20%</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-emerald-600 uppercase mb-2 block">Prix {getUnitLabel()} TTC</label>
                                    <input required type="number" min="0" step="0.01"
                                        className="w-full px-3 py-3 bg-emerald-50/50 border-2 border-emerald-200 rounded-lg font-black text-emerald-700 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                                        value={formData.priceTTC} onChange={e => handleTTCChange(e.target.value)} placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block flex items-center gap-2">
                            <FileText size={14}/> Fiche Technique
                        </label>
                        <textarea rows={3} placeholder="Notes ou spécifications internes..." 
                            className="w-full p-4 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                            value={formData.technicalSpecs} onChange={e => setFormData({...formData, technicalSpecs: e.target.value})}
                        />
                    </div>
                </form>

                {/* FOOTER */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div className="text-red-500 text-sm font-bold flex items-center gap-2">
                        {error && <><AlertCircle size={16}/> {error}</>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-200 rounded-xl">Annuler</button>
                        <button onClick={handleSubmit} disabled={loading} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex items-center gap-2 transition-transform active:scale-95">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Save size={20}/>}
                            {initialData ? 'Mettre à jour' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};