"use client";

import { useState, useTransition } from "react";
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
import { MEDICINE_CATEGORIES } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Medicine } from "@/types/database";

interface MedicineFormDialogProps {
  open: boolean;
  onClose: () => void;
  medicine?: Medicine | null;
}

export function MedicineFormDialog({
  open,
  onClose,
  medicine,
}: MedicineFormDialogProps) {
  const isEdit = !!medicine;
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: medicine?.name ?? "",
    generic_name: medicine?.generic_name ?? "",
    category: medicine?.category ?? "",
    unit_price: medicine?.unit_price?.toString() ?? "",
    cost_price: medicine?.cost_price?.toString() ?? "",
    quantity_in_stock: medicine?.quantity_in_stock?.toString() ?? "",
    reorder_level: medicine?.reorder_level?.toString() ?? "10",
    expiry_date: medicine?.expiry_date ?? "",
    barcode: medicine?.barcode ?? "",
    requires_prescription: medicine?.requires_prescription ?? false,
  });

  function update(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          <div>
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
          <div>
            <Label className="text-muted-foreground">Barcode</Label>
            <Input
              value={form.barcode}
              onChange={(e) => update("barcode", e.target.value)}
              className="bg-background border-border text-white mt-1"
              placeholder="Scan or enter"
            />
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
