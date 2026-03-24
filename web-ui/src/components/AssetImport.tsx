// web-ui/src/components/AssetImport.tsx
import React, { useState, useRef } from 'react';
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

    // 🔧 HELPER: French Number Parser (10,50 -> 10.50)
    const parseFrenchNum = (val: string) => {
        if (!val) return 0;
        // Remove spaces (thousand separators) and swap comma for dot
        const clean = val.toString().replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    // 📥 1. PARSE CSV (Client Side)
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target?.result as string;
                const lines = text.split('\n').filter(l => l.trim() !== '');
                
                // 🕵️ DETECT SEPARATOR (Semi-colon for Excel/French, Comma for US)
                const firstLine = lines[0] || "";
                const separator = firstLine.includes(';') ? ';' : ',';

                // Skip headers (and magic "sep=;" if present)
                const dataLines = lines.filter(l => !l.startsWith('sep=') && !l.toLowerCase().startsWith('reference'));

                const parsed = dataLines.map((line, idx) => {
                    // Remove quotes if Excel added them
                    const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
                    
                    // EXPECTED ORDER: 
                    // 0: Reference (Serial)
                    // 1: Name
                    // 2: Quantity
                    // 3: Unit
                    // 4: Purchase Cost (PAMP)
                    // 5: Price HT (Vente)
                    // 6: VAT (Optional)

                    const serial = cols[0];
                    const name = cols[1];
                    
                    if (!name) return null; // Skip empty rows

                    const qty = parseFrenchNum(cols[2]);
                    const unit = cols[3] || 'UNIT';
                    const cost = parseFrenchNum(cols[4]);
                    const price = parseFrenchNum(cols[5]);
                    
                    // Smart VAT
                    const vatInput = parseFrenchNum(cols[6]);
                    let vatRate = 0.20;
                    if (vatInput === 10 || vatInput === 0.1) vatRate = 0.10;
                    if (vatInput === 14 || vatInput === 0.14) vatRate = 0.14;

                    return {
                        serialNumber: serial || `IMP-${Date.now()}-${idx}`,
                        name: name,
                        quantity: qty,
                        measureUnit: unit,
                        purchaseCost: cost,
                        priceHT: price,
                        vatRate: vatRate
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

        // Sequential Import for Safety
        for (const item of preview) {
            try {
                await client.post('/legal/products', item);
                successCount++;
            } catch (err: any) {
                errorCount++;
                // Check if duplicate serial number
                const msg = err.response?.data?.error || 'Erreur inconnue';
                newLogs.push(`❌ ${item.name} (${item.serialNumber}): ${msg}`);
            }
        }

        setLogs(newLogs);
        setUploading(false);

        if (successCount > 0) {
            // Partial or Full Success
            if (errorCount === 0) {
                alert(`✅ Succès ! ${successCount} produits importés.`);
                onSuccess();
            } else {
                alert(`⚠️ Import Partiel.\n✅ ${successCount} réussis\n❌ ${errorCount} échoués (Voir logs)`);
            }
        }
    };

    // 📥 3. DOWNLOAD TEMPLATE (Updated to match Export format)
    const downloadTemplate = () => {
        let content = "sep=;\n"; // Magic Header
        content += "Reference;Designation;Quantite;Unite;Cout Achat;Prix Vente;TVA %\n";
        content += "MTR-YAM-40;Moteur Yamaha 40CV;5;UNIT;25000,00;32000,00;20\n";
        content += "FIL-PECHE-PRO;Filet Pêche Pro;100,5;METRE;20,50;35,00;10\n";
        
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "Modele_Import_Stock_A.csv";
        a.click();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            <Upload className="text-blue-600"/> Importation de Stock
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Silo A (Legal) • Compatible Excel (CSV)</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                    
                    {!file ? (
                        <div className="space-y-6">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-white hover:border-blue-400 transition-all cursor-pointer group"
                                 onClick={() => fileInput.current?.click()}>
                                <div className="p-4 bg-slate-100 rounded-full group-hover:bg-blue-50 transition-colors mb-4">
                                    <FileSpreadsheet size={48} className="text-slate-400 group-hover:text-blue-600"/>
                                </div>
                                <p className="font-bold text-slate-700 text-lg">Cliquez pour sélectionner un fichier CSV</p>
                                <p className="text-sm text-slate-400 mt-2">Supporte format Excel (10,50) et séparateurs ( ; )</p>
                                <input type="file" ref={fileInput} className="hidden" accept=".csv" onChange={handleFileChange} />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-blue-900">Besoin d'un modèle ?</p>
                                    <p className="text-xs text-blue-600">Téléchargez le fichier exemple compatible Excel.</p>
                                </div>
                                <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 font-bold rounded-lg hover:bg-blue-50 text-xs shadow-sm">
                                    <Download size={14}/> Télécharger Modèle
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-bold">CSV</div>
                                    <div>
                                        <p className="font-bold text-slate-800">{file.name}</p>
                                        <p className="text-xs text-slate-500">{preview.length} articles détectés</p>
                                    </div>
                                </div>
                                <button onClick={() => { setFile(null); setPreview([]); setLogs([]); }} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">Changer de fichier</button>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[400px] overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 font-bold text-slate-500 uppercase sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3">Reference</th>
                                            <th className="p-3">Article</th>
                                            <th className="p-3 text-center">Quantité</th>
                                            <th className="p-3 text-right text-blue-600">Coût (Achat)</th>
                                            <th className="p-3 text-right text-emerald-600">Prix (Vente)</th>
                                            <th className="p-3 text-center">TVA</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {preview.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-mono text-slate-500">{item.serialNumber}</td>
                                                <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                                <td className="p-3 text-center font-bold">
                                                    {item.quantity} <span className="text-[9px] text-slate-400 font-normal uppercase">{item.measureUnit}</span>
                                                </td>
                                                <td className="p-3 text-right font-mono">{item.purchaseCost.toFixed(2)}</td>
                                                <td className="p-3 text-right font-mono font-bold">{item.priceHT.toFixed(2)}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.vatRate === 0.10 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {(item.vatRate * 100).toFixed(0)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {logs.length > 0 && (
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-xs font-mono text-red-700 max-h-32 overflow-y-auto shadow-inner">
                                    <div className="font-bold mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Rapport d'erreurs ({logs.length})</div>
                                    {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <button onClick={onCancel} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Annuler</button>
                    {file && (
                        <button onClick={handleImport} disabled={uploading || preview.length === 0} 
                            className={`px-6 py-3 font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 ${uploading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {uploading ? <RefreshCw className="animate-spin" size={20}/> : <ShieldCheck size={20}/>}
                            {uploading ? 'Traitement en cours...' : 'Confirmer Import Silo A'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};