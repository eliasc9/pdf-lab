import * as pdfjsLib from 'pdfjs-dist';

// Cargar el worker de forma compatible con Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export { pdfjsLib };
