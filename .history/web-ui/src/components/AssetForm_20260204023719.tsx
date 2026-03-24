// web-ui/src/components/AssetForm.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, Anchor, FileText, Ruler, Box, Droplets, Scale } from 'lucide-react';
import client from '../api/client';

interface AssetFormProps {
    onCancel: () => void;
    onSuccess: () => void;
    initialData?: any; 
}

// ✅ LOGIC: Defines the NATURE of the product (Piece vs Weight vs Volume)
const MEASURE_TYPES = [
    { value: 'UNIT', label: 'Par Pièce (U)', icon: Box },
    { value: 'KG',   label: 'Par Poids (KG)', icon: Scale },
    { value: 'L',    label: 'Par Volume (L)', icon: Droplets },
    { value: 'M',    label: 'Par Longueur (M)', icon: Ruler }
];

export const AssetForm: React.FC<AssetFormProps> = ({ onCancel, onSuccess, initialData }) => {
    const [loading, setLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        serialNumber: '',
        purchaseCost: 0, 
        priceHT: 0,      
        vatRate: 0.20,
        quantity: 0,
        measureUnit: 'UNIT', // Default to Piece
        technicalSpecs: ''   // Holds "50kg", "20mm", etc.
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                serialNumber: initialData.serialNumber,
                purchaseCost: Number(initialData.purchaseCost),
                priceHT: Number(initialData.priceHT),
                vatRate: Number(initialData.vatRate),
                quantity: initialData.quantity,
                measureUnit: initialData.measureUnit || 'UNIT',
                technicalSpecs: initialData.technicalSpecs || ''
            });
        }
    }, [initialData]);

    const margin = formData.priceHT - formData.purchaseCost;
    const marginPercent = formData.priceHT > 0 ? (margin / formData.priceHT) * 100 : 0;
    const priceTTC = formData.priceHT * (1 + formData.vatRate);

    // ✅ SAFE ICON RENDERER
    const selectedType = MEASURE_TYPES.find(t => t.value === formData.measureUnit) || MEASURE_TYPES[0];
    const SelectedIcon = selectedType.icon;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                purchaseCost: Number(formData.purchaseCost),
                priceHT: Number(formData.priceHT),
                quantity: Number(formData.quantity)
            };

            if (initialData) {
                await client.put(`/legal/products/${initialData.id}`, payload);
            } else {
                await client.post('/legal/products', payload);
            }
            onSuccess();
        } catch (error: any) {
            alert("Erreur: " + (error.response?.data?.error || "Vérifiez vos données"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        {initialData ? 'Modifier Produit' : 'Nouveau Produit'}
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full uppercase tracking-wide">STOCK A</span>
                    </h2>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X/></button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* LEFT: Identification & Specs */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Anchor size={16}/> Caractéristiques
                            </h3>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Désignation Produit</label>
                                <input required type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder="Ex: Câble Electrique Marine" 
                                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Référence / Série</label>
                                    <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm" 
                                        placeholder="Auto-généré si vide" 
                                        value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} />
                                </div>
                                
                                {/* ✅ LOGIC SELECTOR: Safe Icon Rendering */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Type de Gestion</label>
                                    <div className="relative">
                                        <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 appearance-none"
                                            value={formData.measureUnit} onChange={e => setFormData({...formData, measureUnit: e.target.value})}>
                                            {MEASURE_TYPES.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <SelectedIcon size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Quantité Stock</label>
                                <div className="relative">
                                    <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-bold" 
                                        value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                        {formData.measureUnit}
                                    </span>
                                </div>
                            </div>

                            {/* ✅ SPECS INPUT */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                                    <FileText size={14} className="text-slate-400"/> Spécifications Techniques
                                </label>
                                <textarea 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg h-24 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    placeholder="Ex: Diamètre 20mm, Sac de 50kg, Bobine de 100m, 12 Volts..."
                                    value={formData.technicalSpecs} 
                                    onChange={e => setFormData({...formData, technicalSpecs: e.target.value})}
                                />
                                <p className="text-[10px] text-slate-400 mt-1 text-right">
                                    Inclure ici: Poids (kg), Dimensions (mm/cm), Voltage...
                                </p>
                            </div>
                        </div>

                        {/* RIGHT: Financials */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Calculator size={16}/> Finance & Taxes
                            </h3>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Taux TVA (Maroc)</label>
                                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                    <button type="button" onClick={() => setFormData({...formData, vatRate: 0.20})}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formData.vatRate === 0.20 ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                                        20% (Standard)
                                    </button>
                                    <button type="button" onClick={() => setFormData({...formData, vatRate: 0.10})}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formData.vatRate === 0.10 ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                                        10% (Pêche)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Prix Achat (HT)</label>
                                    <div className="relative">
                                        <input type="number" step="0.01" className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: parseFloat(e.target.value) || 0})} />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">MAD</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Prix Vente (HT)</label>
                                    <div className="relative">
                                        <input type="number" step="0.01" className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900" 
                                            value={formData.priceHT} onChange={e => setFormData({...formData, priceHT: parseFloat(e.target.value) || 0})} />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">MAD</span>
                                    </div>
                                </div>
                            </div>

                            {/* Live Calculations Card */}
                            <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Marge Unitaire</span>
                                    <span className={`text-lg font-mono font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {margin.toFixed(2)} MAD
                                    </span>
                                </div>
                                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mb-4">
                                    <div className={`h-full ${margin >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(Math.max(marginPercent, 0), 100)}%` }}></div>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Prix TTC Final</span>
                                    <span className="text-xl font-black text-white">{priceTTC.toFixed(2)} MAD</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                        <button type="button" onClick={onCancel} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Annuler</button>
                        <button type="submit" disabled={loading} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                            {loading ? 'Enregistrement...' : <><Save size={20}/> Enregistrer le Produit</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};