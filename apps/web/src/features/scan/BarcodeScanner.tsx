import { useState } from 'react';
import { Scanner, type IScannerError } from '@yudiel/react-qr-scanner';
import { CameraOffIcon } from 'lucide-react';
import { normalizeBarcode } from '@puzzle-log/shared';
import { BOX_BARCODE_FORMATS } from '@/lib/scanner';

/**
 * Live camera view that reports the first valid product barcode it sees. Uses the back
 * camera; the browser asks for camera permission the first time.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const [error, setError] = useState<string>();

  if (error) {
    return (
      <div
        role="alert"
        className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-muted-foreground"
      >
        <CameraOffIcon className="size-8" aria-hidden />
        <p>{error}</p>
        <p className="text-sm">You can type the number under the barcode instead.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      <Scanner
        formats={[...BOX_BARCODE_FORMATS]}
        constraints={{ facingMode: 'environment' }}
        sound={false}
        onScan={(codes) => {
          // Ignore misreads: only accept codes with a valid check digit.
          const barcode = codes.map((code) => normalizeBarcode(code.rawValue)).find(Boolean);
          if (barcode) onDetected(barcode);
        }}
        onError={(scannerError: IScannerError) => setError(cameraErrorMessage(scannerError))}
        styles={{ container: { aspectRatio: '4 / 3' }, video: { objectFit: 'cover' } }}
      />
    </div>
  );
}

function cameraErrorMessage({ kind }: IScannerError) {
  switch (kind) {
    case 'permission-denied':
      return 'Camera access was blocked. Allow it in your browser settings to scan.';
    case 'no-camera':
      return "This device doesn't seem to have a camera.";
    case 'in-use':
      return 'Another app is using the camera.';
    case 'insecure-context':
      return 'The camera only works over https.';
    default:
      return "The camera couldn't start.";
  }
}
