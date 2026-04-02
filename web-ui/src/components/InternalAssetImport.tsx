// web-ui/src/components/InternalAssetImport.tsx
import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, AlertTriangle, ShieldCheck, Download, RefreshCw } from 'lucide-react';
import client from '../api/client';

interface Props {
    onCancel: () => void;
    onSuccess: () => void;
}

export const InternalAssetImport: React.FC<Props> = ({ onCancel, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const fileInput = useRef<HTMLInputElement>(null);

    // 🔧 HELPER: French Number Parser (10,50 -> 10.50)
    const parseFrenchNum = (val: string) => {
        if (!val) return 0;
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
                
                const firstLine = lines[0] || "";
                const separator = firstLine.includes(';') ? ';' : ',';

                // Skip headers (and magic "sep=;" if present)
                const dataLines = lines.filter(l => !l.startsWith('sep=') && !l.toLowerCase().startsWith('reference'));

                const parsed = dataLines.map((line, idx) => {
                    const cols = line.split(separator).map(c => c.replace(/"/g, '').trim());
                    
                    // EXPECTED ORDER: Reference | Name | Quantity | Unit | Purchase Cost | Price HT
                    const serial = cols[0];
                    const name = cols[1];
                    
                    if (!name) return null; // Skip empty rows

                    const qty = parseFrenchNum(cols[2]);
                    const unit = cols[3] || 'UNIT';
                    const cost = parseFrenchNum(cols[4]);
                    const price = parseFrenchNum(cols[5]);

                    return {
                        internalSku: serial || `INT-${Date.now()}-${idx}`,
                        name: name,
                        quantity: qty,
                        measureUnit: unit,
                        purchaseCost: cost,
                        sellingPrice: price,
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

        try {
            // We can send the whole array to our new backend endpoint!
            const res = await client.post('/internal/products/batch-import', { products: preview });
            
            if (res.data.errors > 0) {
                 alert(`⚠️ Import Partiel.\n✅ ${res.data.success} réussis\n❌ ${res.data.errors} échoués`);
                 setLogs(res.data.errorDetails || ["Des erreurs se sont produites pendant l'importation."]);
            } else {
                 alert(`✅ Succès ! ${res.data.success} produits importés/mis à jour.`);
                 onSuccess();
            }
        } catch (err: any) {
            setLogs([`❌ Erreur réseau: ${err.message}`]);
        } finally {
            setUploading(false);
        }
    };

    // 📥 3. DOWNLOAD TEMPLATE
    const downloadTemplate = () => {
        let content = "sep=;\n"; // Magic Header
        content += "Reference;Designation;Quantite;Unite;Cout Achat;Prix Vente\n";
        content += "INT-HUILE-40;Huile Moteur 40W;50;L;150,00;200,00\n";
        content += "INT-FIL-01;Filet Standard;100,5;METRE;20,50;35,00\n";
        
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "Modele_Import_Stock_B.csv";
        a.click();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            <Upload className="text-emerald-600"/> Importation de Stock
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Silo B (Interne/POS) • Compatible Excel (CSV)</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                    {!file ? (
                        <div className="space-y-6">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-white hover:border-emerald-400 transition-all cursor-pointer group"
                                 onClick={() => fileInput.current?.click()}>
                                <div className="p-4 bg-slate-100 rounded-full group-hover:bg-emerald-50 transition-colors mb-4">
                                    <FileSpreadsheet size={48} className="text-slate-400 group-hover:text-emerald-600"/>
                                </div>
                                <p className="font-bold text-slate-700 text-lg">Cliquez pour sélectionner un fichier CSV</p>
                                <p className="text-sm text-slate-400 mt-2">Supporte format Excel (10,50) et séparateurs ( ; )</p>
                                <input type="file" ref={fileInput} className="hidden" accept=".csv" onChange={handleFileChange} />
                            </div>

                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-emerald-900">Besoin d'un modèle ?</p>
                                    <p className="text-xs text-emerald-600">Téléchargez le fichier exemple compatible Excel.</p>
                                </div>
                                <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 font-bold rounded-lg hover:bg-emerald-50 text-xs shadow-sm">
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
                                            <th className="p-3">Reference (SKU)</th>
                                            <th className="p-3">Article</th>
                                            <th className="p-3 text-center">Quantité</th>
                                            <th className="p-3 text-right text-emerald-600">Coût (Achat)</th>
                                            <th className="p-3 text-right text-emerald-600">Prix (Vente)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {preview.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-mono text-slate-500">{item.internalSku}</td>
                                                <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                                <td className="p-3 text-center font-bold">
                                                    {item.quantity} <span className="text-[9px] text-slate-400 font-normal uppercase">{item.measureUnit}</span>
                                                </td>
                                                <td className="p-3 text-right font-mono">{item.purchaseCost.toFixed(2)}</td>
                                                <td className="p-3 text-right font-mono font-bold">{item.sellingPrice.toFixed(2)}</td>
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
                            className={`px-6 py-3 font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 ${uploading ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {uploading ? <RefreshCw className="animate-spin" size={20}/> : <ShieldCheck size={20}/>}
                            {uploading ? 'Traitement en cours...' : 'Confirmer Import Silo B'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};