import { useState } from 'react';
import { FileUp, Loader2, ArrowUp, ArrowDown, Trash2, Download, Github, Edit2, Settings2, X } from 'lucide-react';
import { cn } from './lib/utils';
import { Dropzone } from './components/ui/Dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { pdfjsLib } from './lib/pdfjs';
import { downloadFile } from './lib/download';
import { PdfItem, Annotation } from './lib/types';
import { PdfEditor } from './components/PdfEditor';

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

export default function App() {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  
  const [showGlobalEditor, setShowGlobalEditor] = useState(false);

  const handleAddFiles = async (files: File[]) => {
    setIsProcessing(true);
    setProgress({ current: 0, total: files.length, message: 'Parsing files...' });
    
    const newItems: PdfItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        try {
            const arrayBuffer = await f.arrayBuffer();
            let pdf: PDFDocument;
            let pages: number;
            let loadedAnnotations: Annotation[] = [];

            if (f.type.startsWith('image/')) {
                pdf = await PDFDocument.create();
                const image = f.type === 'image/jpeg' ? await pdf.embedJpg(arrayBuffer) : await pdf.embedPng(arrayBuffer);
                const page = pdf.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                pages = 1;
                // Convert the newly created PDF to a File object for consistency
                const pdfBytes = await pdf.save();
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfFile = new File([pdfBlob], f.name.replace(/\.[^/.]+$/, "") + ".pdf", { type: 'application/pdf' });
                
                newItems.push({
                    id: Math.random().toString(36).substring(2, 9),
                    file: pdfFile,
                    name: f.name,
                    size: pdfFile.size,
                    totalPages: 1,
                    range: '1',
                    mode: 'image',
                    annotations: []
                });
            } else {
                const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const pages = pdf.getPageCount();
                const subject = pdf.getSubject();
                let loadedAnnotations: Annotation[] = [];
                if (subject && subject.startsWith("PDF_LAB_STATE:")) {
                   try {
                      const statePayload = JSON.parse(decodeURIComponent(atob(subject.substring(14))));
                      loadedAnnotations = statePayload || [];
                   } catch(ex) {
                      console.warn("Failed to parse metadata");
                   }
                }

                newItems.push({
                    id: Math.random().toString(36).substring(2, 9),
                    file: f,
                    name: f.name,
                    size: f.size,
                    totalPages: pages,
                    range: `1-${pages}`,
                    mode: 'vector',
                    annotations: loadedAnnotations
                });
            }
        } catch (e) {
            console.error("Failed to parse", f.name);
        }
        setProgress({ current: i + 1, total: files.length, message: 'Parsing files...' });
    }
    
    setItems((prev) => [...prev, ...newItems]);
    setIsProcessing(false);
    setProgress(null);
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));
  
  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[newIndex];
    newItems[newIndex] = temp;
    setItems(newItems);
  };
  
  const updateRange = (id: string, range: string) => setItems(items.map(i => i.id === id ? { ...i, range } : i));

  const handleExport = async (exportItems: PdfItem[], exportSettings: { compression: string, forceImage: boolean, embedMetadata?: boolean }) => {
    if (exportItems.length === 0) return;
    setItems(exportItems);
    setIsProcessing(true);
    setProgress({ current: 0, total: 100, message: 'Initializing Export...' });
    
    try {
      const newPdf = await PDFDocument.create();
      const fontNormal = await newPdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await newPdf.embedFont(StandardFonts.HelveticaBold);
      let hasPages = false;
      let totalSteps = 0;
      
      const tasks = exportItems.map(item => {
        const pages = parseRange(item.range, item.totalPages);
        const effectiveMode = exportSettings.forceImage ? 'image' : item.mode;
        if (effectiveMode === 'image') totalSteps += pages.length;
        else totalSteps += 1;
        return { item, pages, effectiveMode };
      });
      
      let processedSteps = 0;
      let globalResultPageIndex = 0;
      const metadataAnnotations: Annotation[] = [];

      for (let i = 0; i < tasks.length; i++) {
        const { item, pages, effectiveMode } = tasks[i];
        if (pages.length === 0) continue;
        
        if (effectiveMode === 'vector') {
            setProgress({ current: processedSteps, total: Math.max(totalSteps, 1), message: `Merging Vector: ${item.name}` });
            const arrayBuffer = await item.file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await newPdf.copyPages(pdf, pages);
            
            copiedPages.forEach((page, idx) => {
                const origIndex = pages[idx];
                const pageAnns = item.annotations.filter(a => a.pageIndex === origIndex);
                const { width, height } = page.getSize();
                
                pageAnns.forEach(ann => {
                   metadataAnnotations.push({ ...ann, pageIndex: globalResultPageIndex });
                   if (ann.type === 'text' && ann.text) {
                       const fontSize = ann.size || 24;
                       const font = ann.bold ? fontBold : fontNormal;
                       const pdfY = height - (ann.y * height); // Direct baseline match
                       page.drawText(ann.text, {
                           x: ann.x * width,
                           y: pdfY,
                           size: fontSize,
                           font: font,
                           color: rgb(0,0,0)
                       });
                   }
                });
                newPdf.addPage(page);
                hasPages = true;
                globalResultPageIndex++;
            });
            processedSteps += 1;
        } else {
            const arrayBuffer = await item.file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            const compressionMap = { 'low': 0.9, 'medium': 0.6, 'high': 0.3 };
            const quality = compressionMap[exportSettings.compression as keyof typeof compressionMap] || 0.6;
            
            for (const pageIndex of pages) {
                setProgress({ current: processedSteps, total: Math.max(totalSteps, 1), message: `Rendering Pg ${pageIndex+1} of ${item.name}` });
                const page = await pdf.getPage(pageIndex + 1); 
                const viewport = page.getViewport({ scale: 2.0 }); 
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    // @ts-ignore
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    
                    const pageAnns = item.annotations.filter(a => a.pageIndex === pageIndex);
                    pageAnns.forEach(ann => {
                       metadataAnnotations.push({ ...ann, pageIndex: globalResultPageIndex });
                       if (ann.type === 'text' && ann.text) {
                           const fontSize = ann.size ? ann.size * 2 : 48; // since we use scale: 2.0
                           ctx.font = `${ann.bold ? '900' : '400'} ${fontSize}px sans-serif`; 
                           ctx.fillStyle = 'black';
                           ctx.textBaseline = 'bottom'; // exact matching to baseline red line
                           ctx.fillText(ann.text, ann.x * canvas.width, ann.y * canvas.height);
                       }
                    });

                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const base64Data = dataUrl.split(',')[1];
                    const uint8Array = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    
                    const embeddedImage = await newPdf.embedJpg(uint8Array);
                    const newPage = newPdf.addPage([embeddedImage.width, embeddedImage.height]);
                    newPage.drawImage(embeddedImage, { x: 0, y: 0, width: embeddedImage.width, height: embeddedImage.height });
                    hasPages = true;
                    globalResultPageIndex++;
                }
                processedSteps++;
            }
        }
      }
      
      if (!hasPages) {
         alert("No valid pages selected across all documents.");
         setIsProcessing(false);
         setProgress(null);
         return;
      }
      
      setProgress({ current: totalSteps, total: totalSteps, message: 'Saving Final PDF...' });
      
      // Save metadata for resuming
      if (exportSettings.embedMetadata !== false && metadataAnnotations.length > 0) {
         try {
           const stateString = btoa(encodeURIComponent(JSON.stringify(metadataAnnotations)));
           newPdf.setSubject("PDF_LAB_STATE:" + stateString);
         } catch(e) {
           console.error("Failed to append metadata", e);
         }
      }

      const pdfBytes = await newPdf.save();
      
      const baseName = exportItems
        .slice(0, 2)
        .map(it => it.name.replace(/\.[^/.]+$/, "").substring(0, 12))
        .join("_") + (exportItems.length > 2 ? "_etc" : "");
      const fileName = `${baseName}_PDFLAB.pdf`.replace(/\s+/g, '_');
      
      downloadFile(pdfBytes, fileName, 'application/pdf');
    } catch (e) {
        console.error(e);
        alert('Failed to export document');
    } finally {
        setIsProcessing(false);
        setProgress(null);
    }
  };

  const handleCancelEditor = (updatedItems: PdfItem[]) => {
    setItems(updatedItems);
    setShowGlobalEditor(false);
  };

  const totalSizeMB = (items.reduce((acc, item) => acc + item.size, 0) / 1024 / 1024).toFixed(2);

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111] font-sans selection:bg-red-200 selection:text-red-900 flex flex-col relative overflow-hidden">
      {showGlobalEditor && (
         <PdfEditor 
            items={items} 
            onExport={handleExport} 
            onCancel={handleCancelEditor} 
         />
      )}

      {/* Header Section */}
      <header className="h-[100px] border-b-4 border-black flex items-center justify-between px-10 bg-white sticky top-0 z-10 hover:border-red-600 transition-colors">
        <div className="text-5xl flex items-center gap-4 font-black tracking-tighter uppercase flex-shrink-0">
          PDF.LAB
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono leading-tight uppercase opacity-50">Session Status</p>
            <p className="text-sm font-bold uppercase">{items.length} Files Loaded / {totalSizeMB} MB</p>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto p-4 sm:p-10 gap-8 h-full">
        
        {/* Document Stage */}
        <section className="flex-1 flex flex-col gap-6 min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-4 border-black pb-4 gap-4">
            <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter">Workspace</h1>
            
            <div className="flex flex-col sm:flex-row items-end gap-3">
               
               <button 
                  onClick={() => setShowGlobalEditor(true)}
                  disabled={items.length === 0 || isProcessing}
                  className={cn(
                    "w-full sm:w-auto h-[56px] px-6 border-4 border-black font-black uppercase flex items-center justify-center gap-2 transition-colors lg:w-48 text-lg",
                    items.length === 0 || isProcessing ? "opacity-50 cursor-not-allowed bg-gray-200 text-gray-500" : "bg-white hover:bg-black hover:text-white shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
                  )}
               >
                 <Edit2 className="w-5 h-5" /> Edit
               </button>

               <button
                  onClick={() => handleExport(items, { compression: 'medium', forceImage: false, embedMetadata: true })}
                  disabled={items.length === 0 || isProcessing}
                  className={cn(
                    "w-full sm:w-auto h-[56px] flex items-center justify-center gap-2 px-6 font-black uppercase transition-all border-4 border-black text-lg",
                    items.length === 0 || isProcessing 
                      ? "opacity-50 cursor-not-allowed bg-gray-200 text-gray-500" 
                      : "bg-red-600 text-white hover:bg-black hover:text-white hover:border-black shadow-[4px_4px_0_0_#000] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]"
                  )}
               >
                 {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                 <span>{isProcessing ? 'Processing...' : 'Export Final PDF'}</span>
               </button>
            </div>
          </div>

          <div className="w-full pb-20">
            {items.length === 0 ? (
               <Dropzone onFiles={handleAddFiles} multiple={true} />
            ) : (
               <div className="flex flex-col gap-4">
                 <AnimatePresence>
                   {items.map((item, index) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={item.id} 
                        className="bg-white border-4 border-black p-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] transition-shadow"
                      >
                        <div className="flex items-center gap-3 w-full lg:w-auto shrink-0">
                          <div className="flex lg:flex-col gap-1">
                            <button 
                              onClick={() => moveItem(index, -1)} 
                              disabled={index === 0}
                              className="p-1 border-2 border-black hover:bg-black hover:text-white disabled:opacity-30 transition-colors"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => moveItem(index, 1)} 
                              disabled={index === items.length - 1}
                              className="p-1 border-2 border-black hover:bg-black hover:text-white disabled:opacity-30 transition-colors"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="w-16 h-20 bg-[#F9F9F9] border-2 border-dashed border-gray-400 flex items-center justify-center font-black text-gray-400 text-2xl group-hover:bg-gray-200 transition-colors">
                            {index + 1}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-1 mb-1">
                          <p 
                            className="font-black uppercase text-xl lg:text-2xl truncate cursor-help" 
                            title={item.name}
                          >
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                             <span className="text-[10px] uppercase font-mono text-gray-500 bg-gray-100 px-2 py-0.5 border border-gray-300">
                               {(item.size / 1024 / 1024).toFixed(2)} MB
                             </span>
                             <span className="text-[10px] uppercase font-mono text-gray-500 bg-gray-100 px-2 py-0.5 border border-gray-300">
                               {item.totalPages} Pages
                             </span>
                             {item.annotations && item.annotations.length > 0 && (
                                <span className="text-[10px] uppercase font-mono text-red-600 bg-red-100 px-2 py-0.5 border border-red-300 font-bold">
                                  {item.annotations.length} Annotations
                                </span>
                             )}
                          </div>
                        </div>

                        <div className="flex items-end gap-3 shrink-0 w-full lg:w-auto">
                          
                          <div className="flex-1 lg:w-48 flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-black">Pages to keep</label>
                            <input 
                              type="text" 
                              value={item.range} 
                              onChange={(e) => updateRange(item.id, e.target.value)} 
                              title="Ex: 1, 3, 5-10. Leave as 1-N for all"
                              placeholder="e.g. 1, 3-5"
                              className="w-full border-4 border-black px-3 font-mono text-sm outline-none focus:border-red-600 transition-colors bg-[#F9F9F9] placeholder-gray-400 h-[48px]"
                            />
                          </div>
                          
                          <button 
                            onClick={() => removeItem(item.id)} 
                            className="p-3 border-4 border-black hover:border-red-600 text-black hover:text-white hover:bg-red-600 transition-colors h-[48px] flex items-center justify-center shrink-0"
                            title="Remove file"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>

                        </div>
                      </motion.div>
                   ))}
                 </AnimatePresence>
                 
                 <motion.div layout className="mt-4">
                    <Dropzone onFiles={handleAddFiles} multiple={true} className="h-28 border-2 border-dashed shadow-none hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)]" />
                 </motion.div>
               </div>
            )}
          </div>
        </section>
      </main>

      <footer className="h-12 bg-black text-white px-4 sm:px-10 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest mt-auto shrink-0 relative z-10">
        <div className="hidden sm:flex items-center gap-6">
          <span>System Architecture: v4.0.0-PRO-EDITION</span>
          <a href="https://github.com/eliasc9/pdf-lab" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-red-500 transition-colors">
            <Github className="w-3 h-3" />
            <span>GitHub / Open Source</span>
          </a>
        </div>
        <div className="flex gap-4 sm:gap-8 items-center w-full sm:w-auto justify-between sm:justify-start">
          <a href="https://github.com/eliasc9/pdf-lab" target="_blank" rel="noopener noreferrer" className="sm:hidden flex items-center gap-2 hover:text-red-500 transition-colors">
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>
          <span className="hidden sm:inline">Local Processing Only</span>
          <span className="text-red-500 font-bold">● LIVE_BUFFER_ACTIVE</span>
        </div>
      </footer>
    </div>
  );
}
