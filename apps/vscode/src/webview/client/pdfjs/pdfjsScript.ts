// assets/pdfjs.js (vite.config.ts): pdf.mjs publishes itself as globalThis.pdfjsLib and the worker
// module as pdfjsWorker, which pdfjs then runs in-thread.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import 'pdfjs-dist/legacy/build/pdf.mjs';
