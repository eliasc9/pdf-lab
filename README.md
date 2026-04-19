# PDF.LAB
**https://pdf.tizaapp.com/ - Offline Merge, Cut and To-Image PDFs.**

PDF.LAB is an advanced, fully client-side (offline-first) browser utility that allows you to easily process PDF documents without uploading them to any remote server. Your data stays in your browser.

## Features
- **Offline First**: Works without an internet connection once loaded.
- **Privacy Focused**: No servers, no uploads. Everything happens on your local machine using WebAssembly and canvas technologies.
- **Merge PDFs**: Combine multiple PDF files into one.
- **Split & Extract**: Select specific pages (e.g. `1, 3, 5-9`) to keep.
- **Image PDF Flattening**: Convert entire PDFs (or specific pages) into flattened image-based PDFs, ideal for securing signatures or read-only forms.
- **Reorder**: Drag and drop visual reordering.

## Infrastructure
This project is configured to run fully static. It outputs to a `dist` directory via Vite and includes a `wrangler.json` to deploy seamlessly to Cloudflare Pages.

## Security
This repository is 100% safe to be public. It does not require any backend API keys, secrets, or remote databases. Output processing is handled strictly using `pdf-lib` and `pdfjs-dist` on the client.
