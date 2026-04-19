export interface Annotation {
  id: string;
  pageIndex: number;
  type: 'text';
  x: number;
  y: number;
  text?: string;
  size?: number;
  bold?: boolean;
}

export interface PdfItem {
  id: string;
  file: File;
  name: string;
  size: number;
  totalPages: number;
  range: string;
  mode: 'vector' | 'image';
  annotations: Annotation[];
}
