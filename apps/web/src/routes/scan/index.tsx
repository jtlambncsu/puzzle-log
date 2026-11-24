import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { normalizeBarcode } from '@puzzle-log/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { BarcodeScanner } from '@/features/scan/BarcodeScanner';

export const Route = createFileRoute('/scan/')({
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string>();

  function check(barcode: string) {
    void navigate({ to: '/scan/$barcode', params: { barcode } });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Have I done this one?
        </h1>
        <p className="text-sm text-muted-foreground">
          Point your camera at the barcode on the puzzle box.
        </p>
      </div>

      <BarcodeScanner onDetected={check} />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const barcode = normalizeBarcode(typed);
          if (barcode) check(barcode);
          else setTypedError("That doesn't look like a barcode number. Check the digits.");
        }}
      >
        <Field data-invalid={!!typedError}>
          <FieldLabel htmlFor="typed-barcode">Or type the number under the barcode</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="typed-barcode"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 0 21081 31114 4"
              value={typed}
              aria-invalid={!!typedError}
              onChange={(event) => {
                setTyped(event.target.value);
                setTypedError(undefined);
              }}
            />
            <Button type="submit" variant="outline">
              <SearchIcon aria-hidden />
              Check
            </Button>
          </div>
          {typedError && <FieldError>{typedError}</FieldError>}
        </Field>
      </form>
    </div>
  );
}
