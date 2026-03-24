// web-ui/src/components/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Building2, MapPin, Phone, FileText } from 'lucide-react';

interface Props {
    onClose: () => void;
}

export const SettingsPage: React.FC<Props> = ({ onClose }) => {
    // Default or Saved Settings
    const [settings, setSettings] = useState({
        companyName: "ISSLI PECHE",
        subtitle: "Équipement Marine",
        address: "19, Rue Bni Aamir - Bourgogne - Casablanca",
        phone: "05 22 20 51 96",
        email: "isslipeche@gmail.com",
        ice: "001664837000074",
        rc: "124637"
    });

    useEffect(() => {
        const saved = localStorage.getItem('legal_settings');
        if (saved) setSettings(JSON.parse(saved));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        localStorage.setItem('legal_settings', JSON.stringify(settings));
        alert("Paramètres enregistrés ! Les futures factures utiliseront ces infos.");
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Building2 size={20}/> Paramètres Société (STOCK A)
                    </h2>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Nom Société</label>
                            <input name="companyName" value={settings.companyName} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded font-bold text-slate-800" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Sous-titre</label>
                            <input name="subtitle" value={settings.subtitle} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><MapPin size={12}/> Adresse</label>
                        <input name="address" value={settings.address} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Phone size={12}/> Tél</label>
                            <input name="phone" value={settings.phone} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                            <input name="email" value={settings.email} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded" />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><FileText size={12}/> ICE</label>
                            <input name="ice" value={settings.ice} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded font-mono text-xs" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">RC</label>
                            <input name="rc" value={settings.rc} onChange={handleChange} className="w-full p-2 border border-slate-200 rounded font-mono text-xs" />
                        </div>
                    </div>

                    <button onClick={handleSave} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex justify-center items-center gap-2">
                        <Save size={18}/> Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};