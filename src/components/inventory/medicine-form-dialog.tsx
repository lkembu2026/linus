"use client";

import React, { useState, useTransition, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createMedicine, updateMedicine } from "@/actions/inventory";
import { MEDICINE_CATEGORIES, DISPENSING_UNITS } from "@/lib/constants";
import { Loader2, ScanBarcode, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { Medicine } from "@/types/database";

interface MedicineFormDialogProps {
  open: boolean;
  onClose: () => void;
  medicine?: Medicine | null;
}

function getInitialForm(medicine?: Medicine | null) {
  return {
    name: medicine?.name ?? "",
    generic_name: medicine?.generic_name ?? "",
    category: medicine?.category ?? "",
    unit_price: medicine?.unit_price?.toString() ?? "",
    cost_price: medicine?.cost_price?.toString() ?? "",
    quantity_in_stock: medicine?.quantity_in_stock?.toString() ?? "",
    reorder_level: medicine?.reorder_level?.toString() ?? "10",
    expiry_date: medicine?.expiry_date ?? "",
    barcode: medicine?.barcode ?? "",
    dispensing_unit: medicine?.dispensing_unit ?? "",
    requires_prescription: medicine?.requires_prescription ?? false,
  };
}

export function MedicineFormDialog({
  open,
  onClose,
  medicine,
}: MedicineFormDialogProps) {
  const isEdit = !!medicine;
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(getInitialForm(medicine));
  const [scanMode, setScanMode] = useState(false);
  const [justScanned, setJustScanned] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when medicine prop changes (e.g. editing a different medicine)
  React.useEffect(() => {
    setForm(getInitialForm(medicine));
    setScanMode(false);
    setJustScanned(false);
  }, [medicine]);

  function update(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Activate scan mode — focus the barcode field so scanner types into it
  function activateScanMode() {
    setScanMode(true);
    setJustScanned(false);
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  }

  // When barcode field changes, detect rapid scanner input (vs manual typing)
  const lastBarcodeChangeRef = useRef<number>(0);
  function handleBarcodeChange(value: string) {
    update("barcode", value);
    const now = Date.now();
    const gap = now - lastBarcodeChangeRef.current;
    lastBarcodeChangeRef.current = now;
    // Scanner pastes the whole string very fast — if last char arrived quickly, it's a scan
    if (scanMode && gap < 80 && value.length >= 3) {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => {
        setScanMode(false);
        setJustScanned(true);
        barcodeInputRef.current?.blur();
        setTimeout(() => setJustScanned(false), 3000);
      }, 120);
    }
  }

  function handleSubmit() {
    if (!form.name || !form.category || !form.unit_price || !form.cost_price) {
      toast.error("Please fill in all required fields");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: form.name,
        generic_name: form.generic_name || undefined,
        category: form.category,
        unit_price: parseFloat(form.unit_price),
        cost_price: parseFloat(form.cost_price),
        quantity_in_stock: parseInt(form.quantity_in_stock) || 0,
        reorder_level: parseInt(form.reorder_level) || 10,
        expiry_date: form.expiry_date || undefined,
        barcode: form.barcode || undefined,
        dispensing_unit: form.dispensing_unit || undefined,
        requires_prescription: form.requires_prescription,
      };

      const result = isEdit
        ? await updateMedicine(medicine!.id, payload)
        : await createMedicine(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Medicine updated" : "Medicine added");
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white font-[family-name:var(--font-sans)]">
            {isEdit ? "Edit Medicine" : "Add New Medicine"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Name */}
          <div className="col-span-2">
            <Label className="text-muted-foreground">Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="Medicine name"
            />
          </div>

          {/* Generic name */}
          <div className="col-span-2">
            <Label className="text-muted-foreground">Generic Name</Label>
            <Input
              value={form.generic_name}
              onChange={(e) => update("generic_name", e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="Generic / scientific name"
            />
          </div>

          {/* Category */}
          <div className="col-span-2">
            <Label className="text-muted-foreground">Category *</Label>
            <Select
              value={form.category}
              onValueChange={(v) => update("category", v)}
            >
              <SelectTrigger className="bg-background border-border text-white mt-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {MEDICINE_CATEGORIES.map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className="text-white focus:bg-primary/10"
                  >
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Barcode */}
          <div className="col-span-2">
            <Label className="text-muted-foreground">Barcode</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Input
                  ref={barcodeInputRef}
                  value={form.barcode}
                  onChange={(e) => handleBarcodeChange(e.target.value)}
                  onBlur={() => {
                    if (scanMode) setScanMode(false);
                  }}
                  className={`bg-background border-border text-white pr-8 transition-colors ${
                    justScanned
                      ? "border-green-500 focus:border-green-500"
                      : scanMode
                        ? "border-primary animate-pulse focus:border-primary"
                        : ""
                  }`}
                  placeholder={
                    scanMode
                      ? "Waiting for scan…"
                      : "Enter barcode or click Scan"
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (scanMode && form.barcode.length >= 3) {
                        setScanMode(false);
                        setJustScanned(true);
                        barcodeInputRef.current?.blur();
                        setTimeout(() => setJustScanned(false), 3000);
                      }
                    }
                  }}
                />
                {justScanned && (
                  <CheckCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {scanMode && (
                  <ScanBarcode className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-pulse" />
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={activateScanMode}
                className={`shrink-0 gap-1.5 ${
                  scanMode
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                <ScanBarcode className="h-4 w-4" />
                {scanMode ? "Scanning…" : "Scan"}
              </Button>
            </div>
            {justScanned && (
              <p className="text-xs text-green-500 mt-1">
                ✓ Barcode captured: {form.barcode}
              </p>
            )}
            {scanMode && (
              <p className="text-xs text-primary/70 mt-1">
                Point your scanner at the product barcode now…
              </p>
            )}
          </div>

          {/* Unit price */}
          <div>
            <Label className="text-muted-foreground">
              Selling Price (KES) *
            </Label>
            <Input
              type="number"
              value={form.unit_price}
              onChange={(e) => update("unit_price", e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="0.00"
            />
          </div>

          {/* Cost price */}
          <div>
            <Label className="text-muted-foreground">Cost Price (KES) *</Label>
            <Input
              type="number"
              value={form.cost_price}
              onChange={(e) => update("cost_price", e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="0.00"
            />
          </div>

          {/* Quantity */}
          <div>
            <Label className="text-muted-foreground">Stock Quantity</Label>
            <Input
              type="number"
              value={form.quantity_in_stock}
              onChange={(e) => update("quantity_in_stock", e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="0"
            />
          </div>

          {/* Reorder level */}
          <div>
            <Label className="text-muted-foreground">Reorder Level</Label>
            <Input
              type="number"
              value={form.reorder_level}
              onChange={(e) => update("reorder_level", e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="10"
            />
          </div>

          {/* Expiry date */}
          <div>
            <Label className="text-muted-foreground">Expiry Date</Label>
            <Input
              type="date"
              value={form.expiry_date}
              onChange={(e) => update("expiry_date", e.target.value)}
              className="bg-background border-border text-white mt-1"
            />
          </div>

          {/* Dispensing unit */}
          <div>
            <Label className="text-muted-foreground">
              Dispensing Unit
              <span className="text-xs text-primary ml-1">(what you sell per qty)</span>
            </Label>
            <Select
              value={form.dispensing_unit}
              onValueChange={(v) => update("dispensing_unit", v)}
            >
              <SelectTrigger className="bg-background border-border text-white mt-1">
                <SelectValue placeholder="e.g. Tablet, ml, Sachet" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {DISPENSING_UNITS.map((u) => (
                  <SelectItem key={u} value={u} className="text-white focus:bg-primary/10">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Stock quantity = number of {form.dispensing_unit || "units"} in stock.
              Selling 3 means 3 {form.dispensing_unit || "units"} are deducted.
            </p>
          </div>

          {/* Prescription */}
          <div className="flex items-center gap-3 pt-6">
            <Switch
              checked={form.requires_prescription}
              onCheckedChange={(v) => update("requires_prescription", v)}
            />
            <Label className="text-muted-foreground">
              Requires Prescription
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : isEdit ? (
              "Update Medicine"
            ) : (
              "Add Medicine"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
