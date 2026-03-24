import React, { useState } from 'react';
import { X, Save, User, MapPin, Hash, Phone, Building, FileText } from 'lucide-react';
import client from '../api/client';

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export const ClientModal: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        ice: '',
        rc: '',
        if: '',
        address: '',
        city: '',
        phone: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field: string, value: string) => {
        let cleanValue = value;
        
        // 🛡️ INPUT MASKING RULES
        // Force Uppercase for Name and City
        if (field === 'name' || field === 'city') {
            cleanValue = value.toUpperCase();
        } 
        // Force Numbers only for Tax IDs
        else if (['ice', 'rc', 'if'].includes(field)) {
            cleanValue = value.replace(/[^0-9]/g, '');
        }

        setFormData(prev => ({ ...prev, [field]: cleanValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await client.post('/legal/clients', formData);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            // Handle specific duplicate errors from backend
            setError(err.response?.data?.error || "Erreur de connexion.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white flex-shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <User className="text-blue-400" /> Nouveau Client (Légal)
                    </h3>
                    <button onClick={onClose} className="hover:bg-slate-700 p-2 rounded-full transition-colors"><X size={20}/></button>
                </div>

                {/* Scrollable Form Area */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg border border-red-100 flex items-center gap-2 animate-pulse">
                            <X size={14}/> {error}
                        </div>
                    )}

                    {/* IDENTITY */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Identité Fiscale</h4>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Raison Sociale <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Building size={16} className="absolute left-3 top-3 text-slate-400"/>
                                <input 
                                    required
                                    autoFocus
                                    type="text" 
                                    placeholder="Ex: SOCIETE EXEMPLE SARL"
                                    className="w-full pl-10 p-2.5 border border-slate-200 rounded-lg font-bold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase"
                                    value={formData.name}
                                    onChange={e => handleChange('name', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">I.C.E</label>
                                <div className="relative">
                                    <Hash size={16} className="absolute left-3 top-3 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        placeholder="001..."
                                        maxLength={15}
                                        className="w-full pl-10 p-2.5 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 outline-none"
                                        value={formData.ice}
                                        onChange={e => handleChange('ice', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">R.C</label>
                                <input 
                                    type="text" 
                                    placeholder="N° RC"
                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 outline-none"
                                    value={formData.rc}
                                    onChange={e => handleChange('rc', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">I.F</label>
                                <input 
                                    type="text" 
                                    placeholder="Id. Fiscal"
                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 outline-none"
                                    value={formData.if}
                                    onChange={e => handleChange('if', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* CONTACT */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Coordonnées</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ville</label>
                                <input 
                                    type="text" 
                                    placeholder="CASABLANCA"
                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 outline-none uppercase"
                                    value={formData.city}
                                    onChange={e => handleChange('city', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Téléphone</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3 top-3 text-slate-400"/>
                                    <input 
                                        type="text" 
                                        placeholder="06 00..."
                                        className="w-full pl-10 p-2.5 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 outline-none"
                                        value={formData.phone}
                                        onChange={e => handleChange('phone', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Adresse Complète</label>
                            <div className="relative">
                                <MapPin size={16} className="absolute left-3 top-3 text-slate-400"/>
                                <input 
                                    type="text" 
                                    placeholder="Adresse Siège Social..."
                                    className="w-full pl-10 p-2.5 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-500 outline-none"
                                    value={formData.address}
                                    onChange={e => handleChange('address', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-200"
                    >
                        {loading ? 'Enregistrement...' : <><Save size={18}/> Enregistrer le Client</>}
                    </button>
                </form>
            </div>
        </div>
    );
};