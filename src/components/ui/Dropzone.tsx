import React, { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  className?: string;
}

export function Dropzone({ onFiles, multiple = true, accept = ".pdf,image/png,image/jpeg,image/webp", className }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const rawFiles = Array.from(e.dataTransfer.files) as File[];
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const files = rawFiles.filter((f) => {
      const name = f.name.toLowerCase();
      return allowedExtensions.some(ext => name.endsWith(ext));
    });
    if (!multiple && files.length > 1) {
      onFiles([files[0]]);
    } else {
      onFiles(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      if (!multiple && files.length > 1) {
        onFiles([files[0]]);
      } else {
        onFiles(files);
      }
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center w-full h-64 border-4 border-dashed rounded-none transition-colors duration-200 group cursor-pointer",
        isDragOver ? "bg-white border-red-600 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)] text-red-600" : "bg-[#F9F9F9] border-black hover:bg-white text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center px-4 gap-1 sm:gap-2">
        <div className={cn("text-3xl sm:text-5xl font-black transition-transform group-hover:scale-110", isDragOver && "scale-110")}>
          +
        </div>
        <div className="text-center">
          <p className="font-black uppercase text-lg sm:text-xl leading-none">Add Files</p>
          <p className="text-[10px] font-mono opacity-50 uppercase mt-1">PDF or Images (Drag & Drop or Click)</p>
        </div>
      </div>
      <input 
        ref={inputRef} 
        type="file" 
        className="hidden" 
        accept={accept} 
        multiple={multiple} 
        onChange={handleFileChange} 
      />
    </div>
  );
}
