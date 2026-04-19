import React, { useState } from 'react';
import { Dropzone } from './ui/Dropzone';
import { downloadFile } from '../lib/download';
import { pdfjsLib } from '../lib/pdfjs';
import JSZip from 'jszip';
import { File as FileIcon, Loader2, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function ImageTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleAddFile = (files: File[]) => {
    if (files.length === 0) return;
    setFile(files[0]);
    setProgress({ current: 0, total: 0 });
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      
      setProgress({ current: 0, total: totalPages });
      const zip = new JSZip();

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        // Usar escala 2.0 (aprox 150-300 DPI dependiendo del PDF base) para mejor calidad
        const viewport = page.getViewport({ scale: 2.0 }); 
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) throw new Error("No 2D context");
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // @ts-ignore
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        
        // Agregar al zip
        zip.file(`pagina_${i.toString().padStart(3, '0')}.png`, base64, { base64: true });
        setProgress({ current: i, total: totalPages });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, `${file.name.replace('.pdf', '')}_imagenes.zip`, 'application/zip');
      
    } catch (error) {
      console.error("Error convirtiendo a imágenes:", error);
      alert("Hubo un error convirtiendo el archivo PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="w-full max-w-full mx-auto space-y-8">
      <div className="hidden">
        {/* Title */}
      </div>

      {!file && (
        <Dropzone onFiles={handleAddFile} multiple={false} />
      )}

      {file && (
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
                <p className="text-[10px] font-mono text-gray-500 uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!isProcessing && (
              <button 
                onClick={() => setFile(null)}
                className="text-sm font-bold uppercase text-red-600 hover:underline underline-offset-4"
              >
                Reset
              </button>
            )}
          </div>
          
          <div className="p-8 space-y-8 bg-[#F9F9F9]">
            {isProcessing ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono uppercase font-bold">
                  <span>Processing Page {progress.current} of {progress.total}...</span>
                  <span className="text-red-600 text-lg">{percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 border-2 border-black h-6 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className="bg-red-600 h-full"
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-6 flex-col items-center space-y-6">
                <div className="flex text-black stroke-black opacity-50">
                   <ImageIcon className="w-16 h-16" strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-center max-w-sm font-bold">
                  Click the button below to generate a ZIP file containing high-quality PNGs of every page.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={handleConvert}
                disabled={isProcessing}
                className={cn(
                  "bg-black text-white px-8 py-4 font-bold text-lg uppercase flex items-center justify-center min-w-[250px] transition-colors",
                  isProcessing ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600"
                )}
              >
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ImageIcon className="w-6 h-6 mr-2" />}
                <span>{isProcessing ? 'Converting...' : 'Convert to Images'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
