// web-ui/src/components/InventorySheet.tsx
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, X, ClipboardList, Package } from 'lucide-react';

interface InventoryItem {
    id: string; 
    name: string; 
    // Handle both types of references
    internalSku?: string; 
    serialNumber?: string;
    quantity: number; 
    measureUnit: string; 
    technicalSpecs?: string;
}

interface SheetProps { 
    products: InventoryItem[]; 
    mode: 'legal' | 'internal';
    onClose: () => void; 
}

export const InventorySheet: React.FC<SheetProps> = ({ products, mode, onClose }) => {
  const componentRef = useRef(null);
  
  // ✅ NAMING: STRICT STOCK A / STOCK B
  const title = mode === 'legal' ? "Inventaire_STOCK_A" : "Inventaire_STOCK_B";
  const dateStr = new Date().toISOString().split('T')[0];

  const handlePrint = useReactToPrint({ 
      contentRef: componentRef, 
      documentTitle: `${title}_${dateStr}` 
  });

  const getUnitLabel = (unit: string) => {
      switch(unit) {
          case 'METER': return 'Mètre';
          case 'KG': return 'Kg';
          case 'LITER': return 'Litre';
          default: return 'Unité';
      }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header UI */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
            <h3 className="font-bold flex items-center gap-2 text-slate-800">
                <ClipboardList /> Fiche de Comptage ({mode === 'legal' ? 'STOCK A' : 'STOCK B'})
            </h3>
            <div className="flex gap-2">
                <button onClick={() => handlePrint()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm transition-all">
                    <Printer size={18} /> Imprimer
                </button>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded text-slate-500"><X size={20} /></button>
            </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
            <div ref={componentRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] text-slate-900 shadow-sm relative font-serif">
                
                {/* PDF Header */}
                <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                            <Package size={24}/> Fiche d'Inventaire
                        </h1>
                        <p className="text-sm font-bold text-gray-500 uppercase mt-1">
                            {mode === 'legal' ? 'Magasin: STOCK A (Légal)' : 'Magasin: STOCK B (Interne)'}
                        </p>
                    </div>
                    <div className="text-right text-xs uppercase font-mono text-gray-600">
                        <p>Date: ____________________</p>
                        <p className="mt-2">Responsable: ________________</p>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full text-sm border-collapse border border-black">
                    <thead>
                        <tr className="bg-gray-100 text-black font-bold uppercase text-xs">
                            <th className="border border-black p-2 text-left w-[20%]">
                                {mode === 'legal' ? 'N° SÉRIE / REF' : 'SKU INTERNE'}
                            </th>
                            <th className="border border-black p-2 text-left w-[35%]">Désignation</th>
                            <th className="border border-black p-2 text-center w-[15%]">Théorique</th>
                            <th className="border border-black p-2 text-center w-[10%]">Unité</th>
                            <th className="border border-black p-2 text-center w-[20%]">RÉEL (Compté)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p.id} className="break-inside-avoid">
                                <td className="border border-black p-2 font-mono font-bold text-xs">
                                    {mode === 'legal' ? (p.serialNumber || '-') : (p.internalSku || '-')}
                                </td>
                                <td className="border border-black p-2">
                                    <span className="font-bold">{p.name}</span>
                                    {p.technicalSpecs && <div className="text-[10px] text-gray-500 italic">{p.technicalSpecs}</div>}
                                </td>
                                <td className="border border-black p-2 text-center text-gray-400 font-mono">
                                    {p.quantity}
                                </td>
                                <td className="border border-black p-2 text-center text-[10px] uppercase">
                                    {getUnitLabel(p.measureUnit)}
                                </td>
                                {/* Empty box for manual counting */}
                                <td className="border border-black p-2"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-center text-gray-400 uppercase tracking-widest">
                    Document généré par ISSLI PECHE ERP • {new Date().toLocaleDateString('fr-MA')} • Page 1/1
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};