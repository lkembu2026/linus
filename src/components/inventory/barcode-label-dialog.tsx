"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Copy, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { updateMedicine } from "@/actions/inventory";
import { toast } from "sonner";
import type { Medicine } from "@/types/database";

interface BarcodeLabelDialogProps {
  open: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  onBarcodeGenerated?: (medicineId: string, barcode: string) => void;
}

/** Generate a simple Code128-safe barcode string from medicine id */
function generateBarcode(medicine: Medicine): string {
  // Use first 8 chars of UUID + last 4 chars → 12 char unique code
  const raw = medicine.id.replace(/-/g, "");
  return `MED${raw.slice(0, 9).toUpperCase()}`;
}

export function BarcodeLabelDialog({
  open,
  onClose,
  medicine,
  onBarcodeGenerated,
}: BarcodeLabelDialogProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [copies, setCopies] = useState(1);
  const [barcode, setBarcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Set barcode value: existing or auto-generated
  useEffect(() => {
    if (!medicine) return;
    setBarcode(medicine.barcode ?? generateBarcode(medicine));
  }, [medicine]);

  // Render barcode SVG whenever value changes
  useEffect(() => {
    if (!barcode || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, barcode, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 6,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // invalid barcode value, ignore
    }
  }, [barcode]);

  async function handleSaveBarcode() {
    if (!medicine) return;
    setSaving(true);
    const result = await updateMedicine(medicine.id, { barcode });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Barcode saved to medicine record");
    onBarcodeGenerated?.(medicine.id, barcode);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    if (!medicine) return;

    // Build N copies of the label
    const labelHtml = Array.from({ length: copies })
      .map(
        () => `
        <div class="label">
          <p class="name">${medicine.name}</p>
          ${medicine.generic_name ? `<p class="generic">${medicine.generic_name}</p>` : ""}
          <svg id="bc-${Math.random().toString(36).slice(2)}"></svg>
          <p class="price">KES ${formatCurrency(medicine.unit_price)}</p>
          ${medicine.expiry_date ? `<p class="exp">Exp: ${medicine.expiry_date}</p>` : ""}
        </div>`,
      )
      .join("");

    const win = window.open("", "_blank", "width=600,height=500");
    if (!win) {
      toast.error("Popup blocked — allow popups for this site");
      return;
    }

    win.document.write(`<!DOCTYPE html><html><head><title>Barcode Labels</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; background:#fff; }
      .page { display:flex; flex-wrap:wrap; gap:8px; padding:10px; }
      .label {
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px 10px;
        width: 200px;
        text-align: center;
        page-break-inside: avoid;
      }
      .name { font-size: 11px; font-weight: bold; color: #000; margin-bottom:2px; }
      .generic { font-size: 9px; color: #555; margin-bottom:4px; }
      .price { font-size: 11px; font-weight: bold; color: #000; margin-top:4px; }
      .exp { font-size: 9px; color: #666; margin-top:2px; }
      svg { max-width:100%; }
      @media print {
        body { margin:0; }
        .page { padding:4px; gap:4px; }
      }
    </style></head><body>
    <div class="page">${labelHtml}</div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
    <script>
      window.onload = function() {
        document.querySelectorAll('svg').forEach(function(el) {
          JsBarcode(el, ${JSON.stringify(barcode)}, {
            format:'CODE128', width:2, height:50,
            displayValue:true, fontSize:10, margin:4,
            background:'#ffffff', lineColor:'#000000'
          });
        });
        setTimeout(function(){ window.print(); }, 500);
      };
    </script></body></html>`);
    win.document.close();
  }

  if (!medicine) return null;
  const hasExistingBarcode = !!medicine.barcode;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white font-[family-name:var(--font-sans)]">
            Barcode Label
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Medicine name */}
          <div className="text-center">
            <p className="text-white font-semibold">{medicine.name}</p>
            {medicine.generic_name && (
              <p className="text-muted-foreground text-xs">
                {medicine.generic_name}
              </p>
            )}
          </div>

          {/* Barcode preview */}
          <div className="flex justify-center rounded-lg bg-white p-3">
            <svg ref={svgRef} />
          </div>

          {/* Barcode value editor */}
          <div>
            <Label className="text-muted-foreground text-xs">
              Barcode Value
            </Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.toUpperCase())}
                className="bg-background border-border text-white font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 border-border text-muted-foreground hover:text-white"
                onClick={handleCopy}
                title="Copy barcode"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {!hasExistingBarcode && (
              <p className="text-xs text-amber-400 mt-1">
                Auto-generated — save this to the medicine record so the scanner
                can find it.
              </p>
            )}
          </div>

          {/* Number of copies */}
          <div>
            <Label className="text-muted-foreground text-xs">
              Number of Labels to Print
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={(e) =>
                setCopies(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="bg-background border-border text-white mt-1 w-24"
            />
          </div>

          {/* Save barcode reminder */}
          {!hasExistingBarcode && (
            <Button
              variant="outline"
              className="w-full border-primary/40 text-primary hover:bg-primary/10"
              onClick={handleSaveBarcode}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Barcode to Medicine Record"}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-primary text-primary-foreground hover:bg-[#00B8A9] gap-2"
          >
            <Printer className="h-4 w-4" />
            Print {copies} Label{copies > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
