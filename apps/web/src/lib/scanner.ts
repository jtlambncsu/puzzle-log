import { setZXingModuleOverrides } from '@yudiel/react-qr-scanner';
// Vite copies the decoder into our build and gives us its URL.
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

/**
 * The scanner decodes barcodes with ZXing compiled to WebAssembly (iPhone Safari has no
 * built-in barcode API). By default it downloads that file from a public CDN; serve our own
 * copy instead, so scanning doesn't depend on a third-party host.
 */
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) =>
    path.endsWith('.wasm') ? zxingWasmUrl : prefix + path,
});

/** Product barcodes printed on puzzle boxes. Fewer formats = faster, fewer misreads. */
export const BOX_BARCODE_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8'] as const;
