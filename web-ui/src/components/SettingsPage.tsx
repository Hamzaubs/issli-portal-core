// web-ui/src/components/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Building2, MapPin, Phone, FileText, DatabaseBackup, Download, Loader2 } from 'lucide-react';
import client from '../api/client'; // Ensures we send the JWT token securely

interface Props {
    onClose: () => void;
}

export const SettingsPage: React.FC<Props> = ({ onClose }) => {
    const [settings, setSettings] = useState({
        companyName: "ISSLI PECHE",
        subtitle: "Équipement Marine",
        address: "19, Rue Bni Aamir - Bourgogne - Casablanca",
        phone: "05 22 20 51 96",
        email: "isslipeche@gmail.com",
        ice: "001664837000074",
        rc: "124637"
    });

    const [isBackingUp, setIsBackingUp] = useState(false);

    useEffect(() => {
        // PRO-TIP: Currently using localStorage, but consider fetching from GET /api/legal/settings in the future!
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

    // ==========================================
    // 💾 TWIN-SILO BACKUP HANDLER
    // ==========================================
    const handleBackup = async () => {
        try {
            setIsBackingUp(true);
            
            // 1. Request the file as a binary Blob
            const response = await client.get('/legal/settings/backup', {
                responseType: 'blob' 
            });

            // 2. Create a temporary memory link for the Blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // 3. Extract the filename from the server headers (or use fallback)
            const contentDisposition = response.headers['content-disposition'];
            let fileName = `ISSLI_PECHE_BACKUP_${new Date().toISOString().split('T')[0]}.zip`;
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
            }

            // 4. Force browser download
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            
            // 5. Cleanup memory
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Backup download error:", error);
            alert("Erreur critique : Impossible de générer la sauvegarde. Vérifiez les logs du serveur.");
        } finally {
            setIsBackingUp(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Building2 size={20}/> Paramètres Système
                    </h2>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                
                {/* SCROLLABLE CONTENT */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    
                    {/* SECTION 1: COMPANY INFO */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b pb-2">Informations Légales (Silo A)</h3>
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
                    </div>

                    {/* SECTION 2: SECURITY & BACKUP */}
                    <div className="space-y-4 pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            <DatabaseBackup size={16} className="text-indigo-600" /> Maintenance & Sécurité
                        </h3>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col gap-3">
                            <p className="text-xs text-indigo-800 leading-relaxed">
                                Le système génère une archive cryptée contenant l'état exact et synchronisé de la base de données <strong>Légale (Silo A)</strong> et <strong>Interne (Silo B)</strong>.
                            </p>
                            <button 
                                onClick={handleBackup} 
                                disabled={isBackingUp}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold shadow-md transition-all flex justify-center items-center gap-2 text-sm"
                            >
                                {isBackingUp ? (
                                    <><Loader2 size={16} className="animate-spin" /> Compression en cours...</>
                                ) : (
                                    <><Download size={16}/> Générer Sauvegarde Complète (.zip)</>
                                )}
                            </button>
                        </div>
                    </div>

                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                    <button onClick={handleSave} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex justify-center items-center gap-2">
                        <Save size={18}/> Enregistrer les Paramètres
                    </button>
                </div>

            </div>
        </div>
    );
};