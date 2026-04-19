import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Dropzone } from './ui/Dropzone';
import { downloadFile } from '../lib/download';
import { File as FileIcon, Loader2, Scissors, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

function parseRange(rangeStr: string, maxPages: number): number[] {
  const indices = new Set<number>();
  const parts = rangeStr.split(',');
  
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    
    if (p.includes('-')) {
      const [startStr, endStr] = p.split('-');
      const start = Number(startStr);
      const end = Number(endStr);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for(let i = start; i <= end; i++) {
          if (i > 0 && i <= maxPages) indices.add(i - 1);
        }
      }
    } else {
      const num = Number(p);
      if (!isNaN(num) && num > 0 && num <= maxPages) {
        indices.add(num - 1);
      }
    }
  }
  
  return Array.from(indices).sort((a,b) => a - b);
}

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [range, setRange] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddFile = async (files: File[]) => {
    if (files.length === 0) return;
    const selected = files[0];
    setFile(selected);
    setIsLoading(true);
    setRange('');
    
    try {
      const arrayBuffer = await selected.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageCount(pdf.getPageCount());
      setRange(`1-${pdf.getPageCount()}`);
    } catch (err) {
      console.error("Error leyendo pagina:", err);
      alert("No se pudo leer el PDF.");
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSplit = async () => {
    if (!file || !range) return;
    setIsProcessing(true);
    
    try {
      const pagesToExtract = parseRange(range, pageCount);
      if (pagesToExtract.length === 0) {
        alert("El rango de páginas no es válido.");
        setIsProcessing(false);
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      
      const copiedPages = await newPdf.copyPages(sourcePdf, pagesToExtract);
      copiedPages.forEach((page) => newPdf.addPage(page));
      
      const pdfBytes = await newPdf.save();
      downloadFile(pdfBytes, `extraido_${file.name}`, 'application/pdf');
    } catch (error) {
      console.error("Error cortando PDF:", error);
      alert("Hubo un error al extraer las páginas.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-full mx-auto space-y-8">
      <div className="hidden">
        <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Cortar o Extraer Páginas</h2>
      </div>

      {!file && (
        <Dropzone onFiles={handleAddFile} multiple={false} />
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <Loader2 className="w-8 h-8 text-black animate-spin" />
          <p className="font-bold uppercase tracking-widest text-sm">Parsing Document...</p>
        </div>
      )}

      {file && !isLoading && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col"
        >
          <div className="p-6 border-b-4 border-black flex items-center justify-between bg-white">
            <div className="flex items-center space-x-4">
              <div className="px-4 py-2 border-2 border-dashed border-gray-400 font-black text-gray-400 text-2xl uppercase">
                PDF
              </div>
              <div>
                <p className="font-black uppercase text-xl truncate max-w-xs">{file.name}</p>
                <p className="text-[10px] font-mono text-gray-500 uppercase">{pageCount} Pages • {(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button 
              onClick={() => setFile(null)}
              className="text-sm font-bold uppercase text-red-600 hover:underline underline-offset-4"
            >
              Reset
            </button>
          </div>
          
          <div className="p-8 space-y-6 bg-[#F9F9F9]">
            <div className="space-y-4">
              <label htmlFor="range" className="block text-sm font-black uppercase tracking-widest">
                Pages to Extract
              </label>
              <input
                id="range"
                type="text"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="Ex. 1, 3, 5-10"
                className="w-full px-6 py-4 border-4 border-black font-mono text-lg outline-none focus:border-red-600 transition-colors uppercase bg-white placeholder-gray-300"
              />
              <div className="flex items-start space-x-2 text-[10px] font-mono uppercase text-gray-500 mt-2">
                <Info className="w-4 h-4 shrink-0" />
                <p>Use commas for single pages and hyphens for ranges (e.g. 1, 3, 5-8).</p>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSplit}
                disabled={!range || isProcessing}
                className={cn(
                  "bg-black text-white px-8 py-4 font-bold text-lg uppercase flex items-center justify-center min-w-[250px] transition-colors",
                  !range || isProcessing ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600"
                )}
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Scissors className="w-6 h-6 mr-2" />}
                <span>{isProcessing ? 'Extracting...' : 'Extract & Download'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
