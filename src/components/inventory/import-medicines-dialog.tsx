"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { bulkCreateMedicines } from "@/actions/inventory";
import { MEDICINE_CATEGORIES, BEAUTY_CATEGORIES, DISPENSING_UNITS } from "@/lib/constants";

// ── Template columns (order matters — matches what the user fills in) ──────────
const TEMPLATE_COLUMNS = [
  "name",
  "generic_name",
  "category",
  "dispensing_unit",
  "unit_price",
  "cost_price",
  "quantity_in_stock",
  "reorder_level",
  "expiry_date",
  "barcode",
  "requires_prescription",
];

const COLUMN_HINTS: Record<string, string> = {
  name: "Paracetamol 500mg",
  generic_name: "Acetaminophen (optional)",
  category: [...MEDICINE_CATEGORIES, ...BEAUTY_CATEGORIES].join(" / "),
  dispensing_unit: DISPENSING_UNITS.join(" / ") + " (optional)",
  unit_price: "50",
  cost_price: "30",
  quantity_in_stock: "200",
  reorder_level: "20",
  expiry_date: "2027-06-30 (optional)",
  barcode: "Leave blank to auto-generate",
  requires_prescription: "TRUE or FALSE",
};

interface ParsedRow {
  name: string;
  generic_name?: string;
  category: string;
  dispensing_unit?: string;
  unit_price: number;
  cost_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  expiry_date?: string;
  barcode: string; // always filled (auto if blank)
  requires_prescription: boolean;
  _rowNum: number;
  _errors: string[];
  _autoBarcode: boolean;
}

function generateBarcode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `MED${ts}${rand}`;
}

function parseRow(raw: Record<string, any>, rowNum: number): ParsedRow {
  const errors: string[] = [];

  const name = String(raw["name"] ?? "").trim();
  if (!name) errors.push("name is required");

  const category = String(raw["category"] ?? "").trim();
  const validCats = [...MEDICINE_CATEGORIES, ...BEAUTY_CATEGORIES] as string[];
  if (!category) {
    errors.push("category is required");
  } else if (!validCats.includes(category)) {
    errors.push(`category "${category}" not valid`);
  }

  const unit_price = parseFloat(
    String(raw["unit_price"] ?? "0").replace(/[^0-9.]/g, ""),
  );
  if (!unit_price || unit_price <= 0) errors.push("unit_price must be > 0");

  const cost_price = parseFloat(
    String(raw["cost_price"] ?? "0").replace(/[^0-9.]/g, ""),
  );
  if (!cost_price || cost_price <= 0) errors.push("cost_price must be > 0");

  const quantity_in_stock = parseInt(String(raw["quantity_in_stock"] ?? "0"));
  const reorder_level = parseInt(String(raw["reorder_level"] ?? "10")) || 10;

  const rawBarcode = String(raw["barcode"] ?? "").trim();
  const autoBarcode = !rawBarcode;
  const barcode = rawBarcode || generateBarcode();

  const expRaw = String(raw["expiry_date"] ?? "").trim();
  const expiry_date = expRaw || undefined;

  const rxRaw = String(raw["requires_prescription"] ?? "false")
    .trim()
    .toLowerCase();
  const requires_prescription =
    rxRaw === "true" || rxRaw === "1" || rxRaw === "yes";

  const generic_name = String(raw["generic_name"] ?? "").trim() || undefined;
  const dispensing_unit =
    String(raw["dispensing_unit"] ?? "").trim() || undefined;

  return {
    name,
    generic_name,
    category,
    dispensing_unit,
    unit_price,
    cost_price,
    quantity_in_stock,
    reorder_level,
    expiry_date,
    barcode,
    requires_prescription,
    _rowNum: rowNum,
    _errors: errors,
    _autoBarcode: autoBarcode,
  };
}

interface ImportMedicinesDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportMedicinesDialog({
  open,
  onClose,
  onImported,
}: ImportMedicinesDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const validRows = rows.filter((r) => r._errors.length === 0);
  const errorRows = rows.filter((r) => r._errors.length > 0);

  // ── Download template ──────────────────────────────────────────────────────
  function downloadTemplate(format: "csv" | "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      TEMPLATE_COLUMNS.map((col) => COLUMN_HINTS[col] ?? ""),
      // Sample row
      [
        "Amoxicillin 250mg",
        "Amoxicillin",
        "Antibiotics",
        "Capsule",
        "80",
        "45",
        "500",
        "50",
        "2027-12-31",
        "",
        "FALSE",
      ],
    ]);

    // Column widths
    ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medicines");

    if (format === "xlsx") {
      XLSX.writeFile(wb, "medicines_import_template.xlsx");
    } else {
      XLSX.writeFile(wb, "medicines_import_template.csv", { bookType: "csv" });
    }
  }

  // ── Parse uploaded file ────────────────────────────────────────────────────
  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
        defval: "",
      });

      // Skip hint row (if any cell looks like a hint)
      const dataRows = raw.filter((r) => {
        const nameVal = String(r["name"] ?? "")
          .trim()
          .toLowerCase();
        return (
          nameVal &&
          nameVal !== "name" &&
          !nameVal.includes("(optional)")
        );
      });

      setRows(dataRows.map((r, i) => parseRow(r, i + 2)));
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Import valid rows ──────────────────────────────────────────────────────
  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const payload = validRows.map(
      ({ _rowNum, _errors, _autoBarcode, ...rest }) => rest,
    );
    const result = await bulkCreateMedicines(payload);

    setImporting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count} medicines imported successfully!`);
    setRows([]);
    setFileName("");
    onImported();
    onClose();
  }

  function handleClose() {
    setRows([]);
    setFileName("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white font-[family-name:var(--font-sans)] flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Medicines from CSV / Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1 — Download template */}
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
            <p className="text-sm font-medium text-white">
              Step 1 — Download the template
            </p>
            <p className="text-xs text-muted-foreground">
              Fill it in with your medicines. Leave the{" "}
              <span className="text-primary">barcode</span> column blank — the
              system will auto-generate unique barcodes for those. The first two
              rows are hints and will be ignored on import.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate("xlsx")}
                className="border-green-600/50 text-green-400 hover:bg-green-600/10 gap-1.5"
              >
                <Download className="h-4 w-4" />
                Download Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate("csv")}
                className="border-border text-muted-foreground hover:text-white gap-1.5"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </div>

          {/* Step 2 — Upload */}
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
            <p className="text-sm font-medium text-white">
              Step 2 — Upload your filled file
            </p>
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click or drag & drop your CSV / Excel file here
              </p>
              {fileName && (
                <p className="text-xs text-primary mt-1">{fileName}</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="space-y-3">
              {/* Summary badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="border-green-500 text-green-400"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {validRows.length} ready to import
                </Badge>
                {errorRows.length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-destructive text-destructive"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {errorRows.length} rows with errors (will be skipped)
                  </Badge>
                )}
                {validRows.filter((r) => r._autoBarcode).length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-amber-500 text-amber-400"
                  >
                    {validRows.filter((r) => r._autoBarcode).length} barcodes
                    auto-generated
                  </Badge>
                )}
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">#</TableHead>
                      <TableHead className="text-muted-foreground">
                        Name
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Category
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Unit
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Sell Price
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Stock
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Barcode
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row._rowNum}
                        className={`border-border ${row._errors.length > 0 ? "opacity-50" : ""}`}
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          {row._rowNum}
                        </TableCell>
                        <TableCell className="text-white text-sm">
                          {row.name || (
                            <span className="text-destructive">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.category}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.dispensing_unit || "—"}
                        </TableCell>
                        <TableCell className="text-white text-sm">
                          KES {row.unit_price}
                        </TableCell>
                        <TableCell className="text-white text-sm">
                          {row.quantity_in_stock}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <span
                            className={
                              row._autoBarcode
                                ? "text-amber-400"
                                : "text-muted-foreground"
                            }
                          >
                            {row.barcode}
                            {row._autoBarcode && (
                              <span className="ml-1 text-[10px] text-amber-400/70">
                                (auto)
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row._errors.length > 0 ? (
                            <span
                              className="text-xs text-destructive"
                              title={row._errors.join(", ")}
                            >
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {row._errors[0]}
                            </span>
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            className="bg-primary text-primary-foreground hover:bg-[#00B8A9] gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import {validRows.length} Medicine
                {validRows.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
