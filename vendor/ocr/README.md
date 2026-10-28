# Browser OCR assets

These files are the browser distributions from `tesseract.js` 7.0.0 and `tesseract.js-core` 7.0.0 (Apache-2.0), and the English `4.0.0_best_int` language data from `@tesseract.js-data/eng` 1.0.0 (package metadata: MIT; data derived from the Tesseract language models). The Tesseract project distributes its language data under Apache-2.0. See `LICENSE-Apache-2.0.txt` and the bundled dependency notices.

Only the LSTM core variants needed by the app's fixed LSTM worker are included. The relaxed-SIMD, SIMD and non-SIMD variants let Tesseract choose based on browser support. All worker, core and language paths are explicitly local; the app does not use the upstream default CDN. These files are included so the buildless app remains available offline after caching, without `npm install`.

Sources: https://github.com/naptha/tesseract.js, https://github.com/naptha/tesseract.js-core, https://github.com/naptha/tessdata and https://github.com/tesseract-ocr/tessdata_best.
