// web-ui/src/components/InternalLabelPrint.tsx
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, Tag, Box, Ruler, Weight, Droplets } from 'lucide-react';
import { Logo } from './Logo';

interface ProductB { 
  name: string; 
  internalSku: string; 
  sellingPrice: number;
  measureUnit: string; 
  technicalSpecs?: string;
}

interface InternalLabelPrintProps { product: ProductB; onClose: () => void; }

export const InternalLabelPrint: React.FC<InternalLabelPrintProps> = ({ product, onClose }) => {
  const componentRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: componentRef, documentTitle: `Label_${product.internalSku}` });

  const getPriceSuffix = (unit: string) => {
      switch(unit) {
          case 'METER': return '/ m';
          case 'KG': return '/ kg';
          case 'LITER': return '/ L';
          default: return '';
      }
  };

  const getUnitIcon = (unit: string) => {
      switch(unit) {
          case 'METER': return <Ruler size={24} className="text-slate-800" />;
          case 'KG': return <Weight size={24} className="text-slate-800" />;
          case 'LITER': return <Droplets size={24} className="text-slate-800" />;
          default: return <Box size={24} className="text-slate-800" />;
      }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Tag size={18} /> Étiquette Rayon</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X size={20} /></button>
        </div>
        
        <div className="bg-slate-200 p-8 flex justify-center">
          {/* 🏷️ PRINTABLE AREA (10cm x 5cm) */}
          <div ref={componentRef} className="bg-white w-[10cm] h-[5cm] p-4 border-2 border-slate-900 flex flex-col justify-between relative overflow-hidden">
            
            <div className="flex justify-between items-start">
                <div className="text-left w-3/4">
                    <h1 className="text-lg font-black uppercase leading-tight line-clamp-2">{product.name}</h1>
                    {product.technicalSpecs && (
                        <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded inline-block mt-1">
                            {product.technicalSpecs}
                        </div>
                    )}
                    <p className="text-xs text-slate-500 font-mono mt-1">{product.internalSku}</p>
                </div>
                <div className="opacity-20">{getUnitIcon(product.measureUnit)}</div>
            </div>

            <div className="flex justify-between items-end border-t-2 border-slate-900 pt-1 mt-auto">
                <div className="flex items-center gap-2">
                    <Logo className="w-6 h-6 text-slate-900" />
                    <div className="text-[8px] font-bold text-slate-400 leading-tight">ISSLI PECHE<br/>(STOCK B)</div>
                </div>
                <div className="text-right">
                    <span className="text-3xl font-black text-slate-900">{product.sellingPrice}</span>
                    <span className="text-xs font-bold text-slate-500 ml-1">DH {getPriceSuffix(product.measureUnit)}</span>
                </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800"><Printer size={18} /> Imprimer</button>
        </div>
      </div>
    </div>
  );
};