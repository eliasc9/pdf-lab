import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Dropzone } from './ui/Dropzone';
import { downloadFile } from '../lib/download';
import { ArrowUp, ArrowDown, X, File as FileIcon, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function MergeTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index - 1];
    newFiles[index - 1] = temp;
    setFiles(newFiles);
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index + 1];
    newFiles[index + 1] = temp;
    setFiles(newFiles);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);
    
    try {
      const mergedPdf = await PDFDocument.create();
      
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      
      const pdfBytes = await mergedPdf.save();
      downloadFile(pdfBytes, 'documentos_unidos.pdf', 'application/pdf');
    } catch (error) {
      console.error("Error uniendo PDFs:", error);
      alert("Hubo un error al unir los PDFs. Revisa los archivos y vuelve a intentarlo.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-full mx-auto space-y-8">
      <div className="hidden">
        {/* Hid top title as Stage title is used */}
      </div>

      {files.length === 0 && <Dropzone onFiles={handleAddFiles} multiple={true} />}

      {files.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 overflow-hidden">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={`${file.name}-${index}`} 
                  className="bg-white border-4 border-black p-4 flex flex-col gap-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative group"
                >
                  <div className="aspect-[3/4] bg-gray-100 border-2 border-dashed border-gray-400 flex items-center justify-center relative group-hover:bg-gray-50 transition-colors">
                    <span className="text-4xl font-black text-gray-300">P.{String(index + 1).padStart(2, '0')}</span>
                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 font-bold uppercase overflow-hidden text-ellipsis whitespace-nowrap max-w-[80%]" title={file.name}>
                      {file.name}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs uppercase font-bold text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button 
                      onClick={() => removeFile(index)} 
                      className="text-red-600 font-bold hover:underline uppercase text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  {/* Reorder controls */}
                  <div className="absolute top-1/2 -left-2 sm:-left-3 -translate-y-1/2 flex flex-col gap-1 z-10">
                    <button 
                      onClick={() => moveUp(index)} 
                      disabled={index === 0}
                      className={cn("bg-black text-white p-1 border-2 border-black hover:bg-white hover:text-black transition-colors rounded-none shadow-sm", index === 0 && "opacity-50 cursor-not-allowed")}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => moveDown(index)} 
                      disabled={index === files.length - 1}
                      className={cn("bg-black text-white p-1 border-2 border-black hover:bg-white hover:text-black transition-colors rounded-none shadow-sm", index === files.length - 1 && "opacity-50 cursor-not-allowed")}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              <motion.div layout>
                <Dropzone onFiles={handleAddFiles} multiple={true} className="h-full aspect-[3/4] sm:aspect-auto" />
              </motion.div>
            </AnimatePresence>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleMerge}
              disabled={files.length < 2 || isProcessing}
              className={cn(
                "bg-black text-white px-8 py-3 font-bold text-lg uppercase flex items-center justify-center min-w-[200px] transition-colors",
                files.length < 2 || isProcessing ? "opacity-50 cursor-not-allowed" : "hover:bg-red-600 hover:text-white"
              )}
            >
              {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
              {isProcessing ? 'Processing...' : 'Export All'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
