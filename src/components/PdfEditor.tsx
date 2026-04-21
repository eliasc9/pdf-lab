import React, { useState, useEffect } from 'react';
import { PdfItem, Annotation } from '../lib/types';
import { pdfjsLib } from '../lib/pdfjs';
import { cn } from '../lib/utils';
import { X, Save, Type, ArrowLeft, Download, Settings2, Loader2, Move, Minus, Plus } from 'lucide-react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

function PdfPageCanvas({ pageProxy }: { pageProxy: PDFPageProxy | null }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    const render = async () => {
      if (!canvasRef.current || !pageProxy) return;
      const viewport = pageProxy.getViewport({ scale: 2.0 });
      canvasRef.current.width = viewport.width;
      canvasRef.current.height = viewport.height;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
         try {
           // @ts-ignore
           await pageProxy.render({ canvasContext: ctx, viewport }).promise;
         } catch(e) {}
      }
    };
    render();
    return () => { active = false; };
  }, [pageProxy]);

  return <canvas ref={canvasRef} className="w-full h-auto block pointer-events-none" />;
}

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

interface PageRenderSpec {
  itemId: string;
  originalPageIndex: number;
  displayIndex: number;
  width: number;
  height: number;
  pageProxy: any;
  itemName: string;
}

interface PdfEditorProps {
  items: PdfItem[];
  onExport: (updatedItems: PdfItem[], settings: { compression: string; forceImage: boolean; embedMetadata: boolean }) => void;
  onCancel: (updatedItems: PdfItem[]) => void;
}

export function PdfEditor({ items, onExport, onCancel }: PdfEditorProps) {
  const [localItems, setLocalItems] = useState<PdfItem[]>(items);
  const [pagesSpecs, setPagesSpecs] = useState<PageRenderSpec[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [settings, setSettings] = useState({ compression: 'medium', forceImage: false, embedMetadata: true });
  const [activeDrag, setActiveDrag] = useState<{ itemId: string; annId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loadPages = async () => {
      try {
        const specs: PageRenderSpec[] = [];
        let displayIdx = 0;
        for (const item of items) {
          const arrayBuffer = await item.file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const pagesToKeep = parseRange(item.range, item.totalPages);
          
          for (const origIdx of pagesToKeep) {
            const page = await pdf.getPage(origIdx + 1);
            const viewport = page.getViewport({ scale: 1.0 });
            specs.push({
               itemId: item.id,
               originalPageIndex: origIdx,
               displayIndex: displayIdx++,
               width: viewport.width,
               height: viewport.height,
               pageProxy: page,
               itemName: item.name
            });
          }
        }
        if (active) {
            setPagesSpecs(specs);
            setIsLoading(false);
        }
      } catch (e) {
        console.error(e);
        if(active) setIsLoading(false);
      }
    };
    loadPages();
    return () => { active = false; };
  }, [items]);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, itemId: string, originalPageIndex: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('input') || target.closest('button') || target.closest('.no-add-text')) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    const newAnn: Annotation = {
       id: Math.random().toString(36).substring(2, 9),
       pageIndex: originalPageIndex,
       type: 'text',
       x, y,
       text: '',
       size: 24,
       bold: true
    };
    
    setLocalItems(prev => prev.map(it => 
       it.id === itemId ? { ...it, annotations: [...(it.annotations || []), newAnn] } : it
    ));
  };

  const updateText = (itemId: string, annId: string, text: string) => {
    setLocalItems(prev => prev.map(it => 
       it.id === itemId ? { 
         ...it, 
         annotations: (it.annotations || []).map(a => a.id === annId ? { ...a, text } : a) 
       } : it
    ));
  };

  const changeTextSize = (itemId: string, annId: string, delta: number) => {
    setLocalItems(prev => prev.map(it => 
       it.id === itemId ? { 
         ...it, 
         annotations: (it.annotations || []).map(a => a.id === annId ? { ...a, size: Math.max(4, Math.min(120, (a.size || 24) + delta)) } : a) 
       } : it
    ));
  };
  
  const toggleBold = (itemId: string, annId: string) => {
    setLocalItems(prev => prev.map(it => 
       it.id === itemId ? { 
         ...it, 
         annotations: (it.annotations || []).map(a => a.id === annId ? { ...a, bold: !a.bold } : a) 
       } : it
    ));
  };
  
  const removeAnn = (itemId: string, annId: string) => {
    setLocalItems(prev => prev.map(it => 
       it.id === itemId ? { 
         ...it, 
         annotations: (it.annotations || []).filter(a => a.id !== annId) 
       } : it
    ));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeDrag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pxLeft = e.clientX - activeDrag.offsetX - rect.left;
    const pxTop = e.clientY - activeDrag.offsetY - rect.top;
    
    const x = Math.max(0, Math.min(1, pxLeft / rect.width));
    const y = Math.max(0, Math.min(1, pxTop / rect.height));
    
    setLocalItems(prev => prev.map(it => 
       it.id === activeDrag.itemId ? { 
         ...it, 
         annotations: (it.annotations || []).map(a => a.id === activeDrag.annId ? { ...a, x, y } : a) 
       } : it
    ));
  };

  const handlePointerUp = () => {
    if (activeDrag) setActiveDrag(null);
  };

  useEffect(() => {
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [activeDrag]);

  const baseSize = localItems.reduce((acc, item) => acc + item.size, 0);
  const metadataPadding = settings.embedMetadata ? localItems.reduce((acc, it) => acc + (it.annotations?.length || 0) * 1500, 0) : 0;
  const totalSizeMB = ((baseSize + metadataPadding) / 1024 / 1024).toFixed(3);
  const compMap: Record<string, number> = { 'ultra': 3.5, 'low': 1.5, 'medium': 0.8, 'high': 0.4 };
  const mult = compMap[settings.compression] || 0.8;
  const estimatedFinalSizeMB = ((baseSize * mult + metadataPadding) / 1024 / 1024).toFixed(3);

  return (
     <div className="flex flex-col lg:flex-row h-full w-full absolute inset-0 z-50 bg-white">
        <div className="lg:w-96 w-full bg-white border-r-4 border-black flex flex-col shrink-0 order-2 lg:order-1 h-[50vh] lg:h-auto overflow-y-auto shadow-[4px_0_0_0_#000] z-20">
           <div className="p-4 border-b-4 border-black bg-black text-white flex items-center justify-between sticky top-0 z-10 gap-2">
              <button onClick={() => onCancel(localItems)} className="hover:text-red-500 transition-colors flex items-center gap-2 font-black uppercase text-xs sm:text-sm shrink-0">
                <ArrowLeft className="w-5 h-5" /> Back <span className="hidden sm:inline">& Save</span>
              </button>
           </div>
           
           <div className="p-6 flex flex-col gap-8 flex-1">
             <div className="flex flex-col gap-8">
                <div>
                    <label className="font-bold uppercase text-xs text-gray-500 mb-2 block tracking-wider">Final Output Mode</label>
                    <div className="flex border-4 border-black font-black uppercase text-sm shadow-[4px_4px_0_0_#000]">
                       <button 
                          onClick={() => setSettings({...settings, forceImage: false})}
                          className={cn("flex-1 py-3 text-center transition-colors border-r-4 border-black", !settings.forceImage ? "bg-black text-white" : "bg-white text-black hover:bg-gray-200")}
                       >Vector (TXT)</button>
                       <button 
                          onClick={() => setSettings({...settings, forceImage: true})}
                          className={cn("flex-1 py-3 text-center transition-colors", settings.forceImage ? "bg-red-600 text-white" : "bg-white text-black hover:bg-gray-200")}
                       >Flatten (IMG)</button>
                    </div>
                </div>

                {settings.forceImage && (
                    <div>
                        <label className="font-bold uppercase text-xs text-gray-500 mb-2 block tracking-wider">Output Resolution & Quality</label>
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                              onClick={() => setSettings({...settings, compression: 'ultra'})}
                              className={cn("py-2 px-1 border-4 border-black font-black uppercase text-[10px] transition-colors shadow-[2px_2px_0_0_#000]", settings.compression === 'ultra' ? "bg-red-600 text-white" : "bg-white text-black hover:bg-gray-100")}
                           >Ultra (HD+)</button>
                           <button 
                              onClick={() => setSettings({...settings, compression: 'low'})}
                              className={cn("py-2 px-1 border-4 border-black font-black uppercase text-[10px] transition-colors shadow-[2px_2px_0_0_#000]", settings.compression === 'low' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100")}
                           >High Quality</button>
                           <button 
                              onClick={() => setSettings({...settings, compression: 'medium'})}
                              className={cn("py-2 px-1 border-4 border-black font-black uppercase text-[10px] transition-colors shadow-[2px_2px_0_0_#000]", settings.compression === 'medium' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100")}
                           >Standard</button>
                           <button 
                              onClick={() => setSettings({...settings, compression: 'high'})}
                              className={cn("py-2 px-1 border-4 border-black font-black uppercase text-[10px] transition-colors shadow-[2px_2px_0_0_#000]", settings.compression === 'high' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100")}
                           >Web (Small)</button>
                        </div>
                    </div>
                )}

                <div>
                    <label className="font-bold uppercase text-xs text-gray-500 mb-2 block tracking-wider">Project Metadata</label>
                    <div className="flex border-4 border-black font-black uppercase text-sm shadow-[4px_4px_0_0_#000]">
                       <button 
                          onClick={() => setSettings({...settings, embedMetadata: true})}
                          className={cn("flex-1 py-3 text-center transition-colors border-r-4 border-black", settings.embedMetadata ? "bg-black text-white" : "bg-white text-black hover:bg-gray-200")}
                       >Embed (Edit Later)</button>
                       <button 
                          onClick={() => setSettings({...settings, embedMetadata: false})}
                          className={cn("flex-1 py-3 text-center transition-colors", !settings.embedMetadata ? "bg-black text-white" : "bg-white text-black hover:bg-gray-200")}
                       >Clean PDF</button>
                    </div>
                </div>

                <div className="pt-4 border-t-2 border-black/10 flex flex-col items-start gap-1">
                    <span className="text-[10px] font-mono uppercase text-gray-500">Est. Processed Size</span>
                    <span className="font-black text-3xl text-red-600">{settings.forceImage ? estimatedFinalSizeMB : '~' + totalSizeMB} MB</span>
                </div>
             </div>
             
             <div className="flex flex-col gap-2">
                <p className="font-bold uppercase text-xs text-gray-500">Active Tool Context</p>
                <div className="flex items-center gap-3 text-sm font-black uppercase bg-gray-100 p-3 border-2 border-black shadow-[2px_2px_0_0_#000]">
                   <Type className="w-5 h-5 text-red-600" /> Insert Text
                </div>
                <p className="text-[10px] font-mono leading-relaxed text-gray-600 mt-1">
                  Click anywhere on the preview pages to overlay text. Annotations adapt to the output mode natively. Use the move icon to reposition.
                </p>
             </div>
           </div>

           <div className="p-6 border-t-4 border-black bg-gray-100 sticky bottom-0 z-10">
              <button 
                 onClick={() => onExport(localItems, settings)}
                 className="w-full py-4 bg-red-600 text-white font-black uppercase border-4 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[0_0_0_0_#000] hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center justify-center gap-2 text-lg"
              >
                 <Download className="w-5 h-5" />
                 Export Final PDF
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-10 order-1 lg:order-2 flex flex-col items-center gap-12 bg-gray-200 relative select-none">
           {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200 z-10 text-black">
                 <Loader2 className="w-12 h-12 animate-spin mb-4" />
                 <p className="font-mono font-bold uppercase tracking-widest">Compiling Workspace...</p>
                 <p className="text-xs font-mono opacity-50 uppercase mt-2 text-center max-w-[300px]">Merging {items.length} files & rendering high-fidelity canvas stream</p>
              </div>
           ) : (
              pagesSpecs.map((spec, index) => {
                 const currentItem = localItems.find(it => it.id === spec.itemId);
                 const pageAnns = currentItem?.annotations?.filter(a => a.pageIndex === spec.originalPageIndex) || [];

                 return (
                     <div key={`${spec.itemId}-${spec.originalPageIndex}`} className="relative shadow-2xl border-2 border-black bg-white" style={{ width: '100%', maxWidth: '900px' }}>
                        <div className="absolute top-0 right-0 flex max-w-[80%] z-10 border-b-2 border-l-2 border-black shadow-[-2px_2px_0_0_rgba(0,0,0,1)]">
                           <div className="bg-black text-white text-[10px] font-mono uppercase px-2 py-1 truncate" title={spec.itemName}>
                              {spec.itemName} (Pg {spec.originalPageIndex + 1})
                           </div>
                           <div className="bg-red-600 text-white text-[12px] font-black uppercase px-3 py-1 flex-shrink-0">
                               FINAL PG {index + 1}
                           </div>
                        </div>
                        <div 
                          className="relative w-full cursor-text transition-all group/page overflow-hidden"
                          style={{ containerType: 'inline-size' }}
                          onPointerMove={handlePointerMove}
                          onClick={(e) => handlePageClick(e, spec.itemId, spec.originalPageIndex)}
                        >
                           <PdfPageCanvas pageProxy={spec.pageProxy} />
                           <div className="absolute inset-0 bg-red-600/5 opacity-0 group-hover/page:opacity-100 transition-opacity pointer-events-none" />
                           
                           {pageAnns.map((ann) => {
                              const dynamicFontSize = `${((ann.size || 24) / spec.width) * 100}cqw`;
                              const isActiveDrag = activeDrag?.annId === ann.id;
                              return (
                                 <div 
                                   key={ann.id}
                                   className={cn("absolute group/ann no-add-text flex flex-col items-start", isActiveDrag ? "z-50" : "z-10")}
                                   style={{ top: `${ann.y * 100}%`, left: `${ann.x * 100}%` }}
                                   onPointerDown={(e) => e.stopPropagation()}
                                   onClick={(e) => e.stopPropagation()}
                                 >
                                    <div className="relative translate-y-[-100%]">
                                        <div 
                                          className="absolute right-full bottom-0 p-1 cursor-move text-gray-500 hover:text-black opacity-0 group-hover/ann:opacity-100 transition-opacity bg-white border-4 border-black hover:bg-gray-100 touch-none flex items-center justify-center shadow-[4px_4px_0_0_#000] mr-4 mb-[-1px]"
                                          onPointerDown={(e) => {
                                            const parentRect = e.currentTarget.closest('.group\\/page')?.getBoundingClientRect();
                                            if (parentRect) {
                                              const absoluteX = parentRect.left + (ann.x * parentRect.width);
                                              const absoluteY = parentRect.top + (ann.y * parentRect.height);
                                              setActiveDrag({ itemId: spec.itemId, annId: ann.id, offsetX: e.clientX - absoluteX, offsetY: e.clientY - absoluteY });
                                            }
                                          }}
                                        >
                                           <Move className="w-5 h-5" />
                                        </div>
                                        
                                        <div className="relative">
                                           <input 
                                              autoFocus
                                              value={ann.text || ''}
                                              onChange={(e) => updateText(spec.itemId, ann.id, e.target.value)}
                                              className={cn("bg-transparent border-none text-black outline-none w-auto hover:bg-yellow-200/20 transition-colors leading-none m-0 p-0 block", ann.bold ? "font-black" : "font-normal")}
                                              style={{ fontSize: dynamicFontSize, minWidth: '4px' }}
                                              placeholder="Type..."
                                           />
                                           <div className="absolute top-[100%] left-0 right-0 h-[2px] bg-red-600/60 pointer-events-none" />
                                        </div>
                                    </div>
                                    
                                    <div 
                                      className={cn("absolute left-0 top-0 bg-black text-white flex border-4 border-black transition-opacity pointer-events-auto h-[36px] items-center shadow-[4px_4px_0_0_#000]", isActiveDrag ? "opacity-0" : "opacity-0 group-hover/ann:opacity-100")}
                                    >
                                       <button onClick={(e) => { e.stopPropagation(); toggleBold(spec.itemId, ann.id); }} className={cn("h-full px-4 border-r-4 border-black flex items-center justify-center font-serif text-sm transition-colors", ann.bold ? "bg-red-600 font-bold" : "hover:bg-gray-800")} title="Toggle Bold">B</button>
                                       <button onClick={(e) => { e.stopPropagation(); changeTextSize(spec.itemId, ann.id, -2); }} className="h-full px-3 hover:bg-red-600 border-r-4 border-black flex items-center justify-center" title="Decrease Size"><Minus className="w-4 h-4" /></button>
                                       <div className="h-full px-4 text-xs font-mono flex items-center justify-center font-bold bg-white text-black border-r-4 border-black min-w-[3.5rem]">{ann.size || 24}</div>
                                       <button onClick={(e) => { e.stopPropagation(); changeTextSize(spec.itemId, ann.id, 2); }} className="h-full px-3 hover:bg-red-600 border-r-4 border-black flex items-center justify-center" title="Increase Size"><Plus className="w-4 h-4" /></button>
                                       <button onClick={(e) => { e.stopPropagation(); removeAnn(spec.itemId, ann.id); }} className="h-full px-4 hover:bg-red-600 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                 );
              })
           )}
        </div>
     </div>
  );
}
