import React, { useState, useRef } from 'react';
// ✅ FIX: Added 'RefreshCw' to imports
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle, ShieldCheck, Download, RefreshCw } from 'lucide-react';
import client from '../api/client';

interface Props {
    onCancel: () => void;
    onSuccess: () => void;
}

export const AssetImport: React.FC<Props> = ({ onCancel, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const fileInput = useRef<HTMLInputElement>(null);

    // 📥 1. PARSE CSV (Client Side)
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target?.result as string;
                const lines = text.split('\n').filter(l => l.trim() !== '');
                
                // Skip header, parse rows
                const parsed = lines.slice(1).map((line, idx) => {
                    // Split by comma or semicolon
                    const cols = line.split(/[;,]/).map(c => c.replace(/"/g, '').trim());
                    
                    // CSV Columns: Name, Serial, Qty, PurchaseCost, PriceHT, VatRate, Unit
                    const name = cols[0];
                    if (!name) return null; // Skip empty rows

                    const vatInput = parseFloat(cols[5]);
                    // Smart VAT detection (handles 10, 0.1, 20, 0.2)
                    let vatRate = 0.20;
                    if (vatInput === 10 || vatInput === 0.1) vatRate = 0.10;

                    return {
                        name: cols[0],
                        serialNumber: cols[1] || `IMP-${Date.now()}-${idx}`,
                        quantity: parseInt(cols[2]) || 0,
                        purchaseCost: parseFloat(cols[3]) || 0, // ✅ Cost
                        priceHT: parseFloat(cols[4]) || 0,      // ✅ Price
                        vatRate: vatRate,                       // ✅ VAT
                        measureUnit: cols[6] || 'UNIT'
                    };
                }).filter(Boolean);

                setPreview(parsed);
            };
            reader.readAsText(f);
        }
    };

    // 📤 2. SEND TO API
    const handleImport = async () => {
        if (preview.length === 0) return;
        setUploading(true);
        setLogs([]);

        let successCount = 0;
        let errorCount = 0;
        const newLogs = [];

        // We send items sequentially to ensure stability
        for (const item of preview) {
            try {
                await client.post('/legal/products', item);
                successCount++;
            } catch (err: any) {
                errorCount++;
                newLogs.push(`❌ ${item.name}: ${err.response?.data?.error || 'Erreur inconnue'}`);
            }
        }

        setLogs(newLogs);
        setUploading(false);

        if (successCount > 0) {
            alert(`Import terminé !\n✅ ${successCount} succès\n❌ ${errorCount} erreurs`);
            onSuccess(); // Refresh Dashboard
        }
    };

    // 📥 3. DOWNLOAD TEMPLATE
    const downloadTemplate = () => {
        const headers = "Nom,Reference,Quantite,Prix_Achat_HT,Prix_Vente_HT,TVA (0.20 ou 0.10),Unite";
        const example = "Moteur Yamaha 40CV,MTR-001,5,25000,32000,0.20,UNIT\nFilet Pêche Pro,FIL-99,100,200,350,0.10,METER";
        
        const blob = new Blob([`${headers}\n${example}`], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "Modele_Import_Stock_Legal.csv";
        a.click();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            <Upload className="text-blue-600"/> Importation de Stock
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Silo A (Legal) • Format CSV</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    
                    {!file ? (
                        <div className="space-y-6">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer"
                                 onClick={() => fileInput.current?.click()}>
                                <FileSpreadsheet size={48} className="text-slate-300 mb-4"/>
                                <p className="font-bold text-slate-700">Cliquez pour sélectionner un fichier CSV</p>
                                <p className="text-xs text-slate-400 mt-2">Format: Nom, Réf, Qté, Coût, Prix, TVA, Unité</p>
                                <input type="file" ref={fileInput} className="hidden" accept=".csv" onChange={handleFileChange} />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-blue-900">Besoin d'un modèle ?</p>
                                    <p className="text-xs text-blue-600">Téléchargez le fichier CSV exemple pour éviter les erreurs.</p>
                                </div>
                                <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 font-bold rounded-lg hover:bg-blue-50 text-xs">
                                    <Download size={14}/> Télécharger Modèle
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-bold">CSV</div>
                                    <div>
                                        <p className="font-bold text-slate-800">{file.name}</p>
                                        <p className="text-xs text-slate-500">{preview.length} articles détectés</p>
                                    </div>
                                </div>
                                <button onClick={() => { setFile(null); setPreview([]); setLogs([]); }} className="text-xs font-bold text-red-500 hover:underline">Changer de fichier</button>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 font-bold text-slate-500 uppercase sticky top-0">
                                        <tr>
                                            <th className="p-3">Article</th>
                                            <th className="p-3 text-right text-blue-600">Coût (Achat)</th>
                                            <th className="p-3 text-right text-emerald-600">Prix (Vente)</th>
                                            <th className="p-3 text-center">TVA</th>
                                            <th className="p-3 text-center">Qté</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {preview.map((item, i) => (
                                            <tr key={i}>
                                                <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                                <td className="p-3 text-right font-mono">{item.purchaseCost}</td>
                                                <td className="p-3 text-right font-mono">{item.priceHT}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded ${item.vatRate === 0.10 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {item.vatRate * 100}%
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-bold">{item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {logs.length > 0 && (
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-xs font-mono text-red-700 max-h-32 overflow-y-auto">
                                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">Annuler</button>
                    {file && (
                        <button onClick={handleImport} disabled={uploading || preview.length === 0} 
                            className={`px-6 py-3 font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all ${uploading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {uploading ? <RefreshCw className="animate-spin" size={20}/> : <ShieldCheck size={20}/>}
                            {uploading ? 'Importation...' : 'Confirmer Import Silo A'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};