# PDF.LAB
**https://pdf.tizaapp.com/ - Offline Merge, Cut and To-Image PDFs.**

PDF.LAB is an advanced, fully client-side (offline-first) browser utility that allows you to easily process PDF documents without uploading them to any remote server. Your data stays in your browser.

## Key Features
- **PDF & Image Support**: Merge PDFs and images (`JPG`, `PNG`, `WebP`) into a single document.
- **Visual Annotations**: Add and edit text layers directly on any page.
- **Page Extraction**: Select specific pages or ranges to keep (e.g. `1, 3, 5-10`).
- **Resumable Edits**: Saves editing state inside PDF metadata for future modifications.
- **Flattening Mode**: Secure documents by converting them into non-editable image-based PDFs.
- **Privacy First**: 100% offline processing. No data ever leaves your computer.

## Infrastructure
This project is configured to run fully static. It outputs to a `dist` directory via Vite and includes a `wrangler.json` to deploy seamlessly to Cloudflare Pages.

## Security
This repository is 100% safe to be public. It does not require any backend API keys, secrets, or remote databases. Output processing is handled strictly using `pdf-lib` and `pdfjs-dist` on the client.
