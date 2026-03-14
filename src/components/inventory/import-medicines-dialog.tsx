"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { bulkCreateMedicines } from "@/actions/inventory";
import {
  MEDICINE_CATEGORIES,
  BEAUTY_CATEGORIES,
  DISPENSING_UNITS,
} from "@/lib/constants";

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
  _expiryOptions?: string[]; // multiple expiry dates detected
}

type ImportFormat = "template" | "lk-invoice";

// ── Category auto-detection from medicine name keywords ──────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Antibiotics: [
    "amoxicillin", "amoxycillin", "ampiclox", "ampicillin", "ceftriaxone",
    "ciprofloxacin", "cotrimoxazole", "metronidazole", "azithromycin",
    "doxycycline", "erythromycin", "cephalexin", "cloxacillin",
    "flucloxacillin", "gentamicin", "penicillin", "tetracycline",
    "clarithromycin", "norfloxacin", "nitrofurantoin", "augmentin",
    "cefuroxime", "cefixime", "clindamycin", "lincomycin",
  ],
  Painkillers: [
    "paracetamol", "ibuprofen", "diclofenac", "aspirin", "brufen",
    "brustan", "mefenamic", "piroxicam", "celecoxib", "tramadol",
    "naproxen", "ketoprofen", "indomethacin", "meloxicam", "ibupara",
  ],
  Antihistamines: [
    "cetirizine", "loratadine", "chlorphenamine", "chlorpheniramine",
    "promethazine", "diphenhydramine", "fexofenadine", "piriton", "cpm",
  ],
  Antacids: [
    "magnesium trisilicate", "aluminium hydroxide", "gaviscon",
    "sodium bicarbonate", "calcium carbonate",
  ],
  Antifungals: [
    "fluconazole", "clotrimazole", "ketoconazole", "miconazole",
    "nystatin", "terbinafine", "griseofulvin", "itraconazole",
  ],
  Cardiovascular: [
    "amlodipine", "atenolol", "losartan", "carditan", "enalapril",
    "lisinopril", "nifedipine", "propranolol", "captopril", "valsartan",
    "telmisartan", "ramipril", "furosemide", "frusemide",
    "hydrochlorothiazide", "spironolactone", "methyldopa", "hydralazine",
  ],
  Diabetes: [
    "metformin", "glucomet", "glibenclamide", "gliclazide", "glimepiride",
    "insulin",
  ],
  Respiratory: [
    "salbutamol", "montelukast", "aminophylline", "theophylline",
    "beclomethasone", "budesonide", "fluticasone", "ventolin",
  ],
  "Vitamins & Supplements": [
    "vitamin", "multivitamin", "folic acid", "iron sucrose", "ferrous",
    "calcium ", "zinc", "neurobion", "neurobione", "neuroforte",
    "b-complex", "ascorbic",
  ],
  Gastrointestinal: [
    "omeprazole", "ranitidine", "loperamide", "metoclopramide",
    "domperidone", "hyoscine", "buscopan", "famotidine", "esomeprazole",
    "pantoprazole", "lansoprazole",
  ],
  Dermatology: [
    "betamethasone", "betason", "hydrocortisone", "calamine",
    "silver sulfadiazine", "fusidic", "mupirocin",
  ],
  "Eye & Ear": ["eye drop", "ear drop", "timolol"],
};

const FORM_CATEGORY_HINTS: Record<string, string> = {
  cream: "Dermatology",
  ointment: "Dermatology",
  " oint ": "Dermatology",
  " oint": "Dermatology",
  gel: "Dermatology",
  lotion: "Dermatology",
};

function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  for (const [form, category] of Object.entries(FORM_CATEGORY_HINTS)) {
    if (lower.includes(form)) return category;
  }
  return "Other";
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

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

function parseNumeric(value: unknown) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeExpiryDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  const matches = raw.match(/\d{1,2}[/-]\d{1,2}[/-]\d{4}/g);
  const candidate = matches?.[0] ?? raw;
  const parts = candidate.split(/[/-]/);
  if (parts.length !== 3) return undefined;

  const [day, month, year] = parts;
  if (!day || !month || !year) return undefined;

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseAllExpiryDates(value: unknown): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  const matches = raw.match(/\d{1,2}[/-]\d{1,2}[/-]\d{4}/g);
  if (!matches || matches.length === 0) return [];

  return matches
    .map((m) => {
      const parts = m.split(/[/-]/);
      if (parts.length !== 3) return null;
      const [day, month, year] = parts;
      if (!day || !month || !year) return null;
      return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    })
    .filter(Boolean) as string[];
}

function detectImportFormat(rows: unknown[][]): ImportFormat {
  const hasTemplateHeader = rows.some((row) =>
    row.some((cell) => normalizeHeader(cell) === "name"),
  );

  if (hasTemplateHeader) {
    return "template";
  }

  const hasInvoiceHeader = rows.some((row) => {
    const headers = row.map(normalizeHeader);
    return (
      headers.includes("description") &&
      headers.includes("batch no") &&
      headers.includes("exp date") &&
      headers.includes("price")
    );
  });

  return hasInvoiceHeader ? "lk-invoice" : "template";
}

function parseInvoiceRows(sheetRows: unknown[][]): ParsedRow[] {
  const headerIndex = sheetRows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return (
      headers.includes("description") &&
      headers.includes("batch no") &&
      headers.includes("exp date") &&
      headers.includes("price")
    );
  });

  if (headerIndex === -1) {
    return [];
  }

  const headerRow = sheetRows[headerIndex].map(normalizeHeader);
  const descriptionIndex = headerRow.indexOf("description");
  const batchIndex = headerRow.indexOf("batch no");
  const qtyOutIndex = headerRow.indexOf("qty out");
  const expDateIndex = headerRow.indexOf("exp date");
  const qtyIndex = headerRow.indexOf("qty");
  const priceIndex = headerRow.indexOf("price");

  return sheetRows
    .slice(headerIndex + 1)
    .map((row, offset) => {
      const description = String(row[descriptionIndex] ?? "").trim();
      const barcodeRaw = String(row[batchIndex] ?? "").trim();
      const quantity = Math.round(
        parseNumeric(row[qtyIndex] ?? 0) || parseNumeric(row[qtyOutIndex] ?? 0),
      );
      const costPrice = parseNumeric(row[priceIndex] ?? 0);

      // Parse all expiry dates and pick the latest
      const allDates = parseAllExpiryDates(row[expDateIndex]);
      const expiryDate =
        allDates.length > 0
          ? allDates.reduce((a, b) => (a > b ? a : b))
          : normalizeExpiryDate(row[expDateIndex]);

      const category = guessCategory(description);

      const normalized = parseRow(
        {
          name: description,
          generic_name: "",
          category,
          dispensing_unit: "",
          unit_price: costPrice,
          cost_price: costPrice,
          quantity_in_stock: quantity,
          reorder_level: 10,
          expiry_date: expiryDate,
          barcode: barcodeRaw,
          requires_prescription: false,
        },
        headerIndex + offset + 2,
      );

      // Attach multi-expiry options if more than one date
      if (allDates.length > 1) {
        normalized._expiryOptions = allDates;
      }

      return normalized;
    })
    .filter(
      (row) =>
        row.name || row.barcode || row.quantity_in_stock || row.cost_price,
    );
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
  const [importFormat, setImportFormat] = useState<ImportFormat | null>(null);
  const [step, setStep] = useState<"upload" | "review">("upload");

  const ALL_CATEGORIES = [
    ...MEDICINE_CATEGORIES,
    ...BEAUTY_CATEGORIES,
  ] as string[];
  const validRows = rows.filter((r) => r._errors.length === 0);
  const errorRows = rows.filter((r) => r._errors.length > 0);
  const multiExpiryRows = rows.filter(
    (r) => r._expiryOptions && r._expiryOptions.length > 1,
  );

  // ── Download template ──────────────────────────────────────────────────────
  function downloadTemplate(format: "csv" | "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      TEMPLATE_COLUMNS.map((col) => COLUMN_HINTS[col] ?? ""),
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
      const aoa = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        blankrows: false,
      }) as unknown[][];

      const detectedFormat = detectImportFormat(aoa);
      setImportFormat(detectedFormat);

      if (detectedFormat === "lk-invoice") {
        const parsed = parseInvoiceRows(aoa);
        setRows(parsed);
        if (parsed.length > 0) setStep("review");
        return;
      }

      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
        defval: "",
      });
      const dataRows = raw.filter((r) => {
        const nameVal = String(r["name"] ?? "")
          .trim()
          .toLowerCase();
        return nameVal && nameVal !== "name" && !nameVal.includes("(optional)");
      });
      const parsed = dataRows.map((r, i) => parseRow(r, i + 2));
      setRows(parsed);
      if (parsed.length > 0) setStep("review");
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Edit helpers ───────────────────────────────────────────────────────────
  function updateRow(
    index: number,
    field: keyof ParsedRow,
    value: string | number | boolean,
  ) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        // Re-validate after edit
        const errors: string[] = [];
        if (!String(updated.name).trim()) errors.push("name is required");
        if (!ALL_CATEGORIES.includes(updated.category))
          errors.push(`category "${updated.category}" not valid`);
        if (!updated.unit_price || updated.unit_price <= 0)
          errors.push("unit_price must be > 0");
        if (!updated.cost_price || updated.cost_price <= 0)
          errors.push("cost_price must be > 0");
        updated._errors = errors;
        return updated;
      }),
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Import valid rows ──────────────────────────────────────────────────────
  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const payload = validRows.map(
      ({ _rowNum, _errors, _autoBarcode, _expiryOptions, ...rest }) => rest,
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
    setStep("upload");
    onImported();
    onClose();
  }

  function handleClose() {
    setRows([]);
    setFileName("");
    setImportFormat(null);
    setStep("upload");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className={`bg-card border-border ${step === "review" ? "max-w-5xl max-h-[90vh] flex flex-col" : "max-w-4xl max-h-[90vh] overflow-y-auto"}`}
      >
        <DialogHeader>
          <DialogTitle className="text-white font-[family-name:var(--font-sans)] flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {step === "upload"
              ? "Import Medicines from CSV / Excel"
              : "Review & Edit Before Import"}
          </DialogTitle>
          {step === "review" && (
            <DialogDescription>
              Review the parsed data below. Fix categories, expiry dates, and
              prices before importing. Rows with errors will be skipped.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* ─── Upload Step ─── */}
        {step === "upload" && (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
              <p className="text-sm font-medium text-white">
                Step 1 — Download the template
              </p>
              <p className="text-xs text-muted-foreground">
                Fill it in with your medicines. Leave the{" "}
                <span className="text-primary">barcode</span> column blank — the
                system will auto-generate unique barcodes for those.
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

            <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
              <p className="text-sm font-medium text-white">
                Step 2 — Upload your filled file
              </p>
              <p className="text-xs text-muted-foreground">
                Supports both the standard LK import template and the supplier
                invoice file with columns like
                <span className="text-primary"> DESCRIPTION</span>,
                <span className="text-primary"> BATCH NO.</span>,
                <span className="text-primary"> EXP DATE</span>, and
                <span className="text-primary"> PRICE</span>. Categories will be
                auto-detected from medicine names.
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
          </div>
        )}

        {/* ─── Review & Edit Step ─── */}
        {step === "review" && (
          <div className="flex-1 min-h-0 space-y-3">
            {/* Summary badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {importFormat && (
                <Badge
                  variant="outline"
                  className="border-primary/50 text-primary"
                >
                  {importFormat === "lk-invoice"
                    ? "LK supplier invoice"
                    : "Standard template"}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="border-green-500 text-green-400"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {validRows.length} ready
              </Badge>
              {errorRows.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-destructive text-destructive"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {errorRows.length} with errors
                </Badge>
              )}
              {multiExpiryRows.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-400"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {multiExpiryRows.length} with multiple expiry dates
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                  setFileName("");
                  setImportFormat(null);
                }}
                className="ml-auto text-xs text-muted-foreground"
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                Re-upload
              </Button>
            </div>

            {/* Editable table */}
            <ScrollArea className="h-[55vh] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 border-border">
                    <TableHead className="w-8 text-center text-muted-foreground">
                      #
                    </TableHead>
                    <TableHead className="min-w-[180px] text-muted-foreground">
                      Name
                    </TableHead>
                    <TableHead className="w-[140px] text-muted-foreground">
                      Category
                    </TableHead>
                    <TableHead className="w-[70px] text-muted-foreground">
                      Qty
                    </TableHead>
                    <TableHead className="w-[90px] text-muted-foreground">
                      Cost
                    </TableHead>
                    <TableHead className="w-[90px] text-muted-foreground">
                      Sell
                    </TableHead>
                    <TableHead className="w-[130px] text-muted-foreground">
                      Expiry Date
                    </TableHead>
                    <TableHead className="w-[110px] text-muted-foreground">
                      Barcode
                    </TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={`${row._rowNum}-${idx}`}
                      className={`border-border ${row._errors.length > 0 ? "bg-destructive/5" : ""}`}
                    >
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            updateRow(idx, "name", e.target.value)
                          }
                          className="h-8 text-sm"
                          placeholder="Medicine name"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.category}
                          onValueChange={(val) =>
                            updateRow(idx, "category", val)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.quantity_in_stock}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "quantity_in_stock",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm w-16"
                          min={0}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.cost_price}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "cost_price",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm w-20"
                          min={0}
                          step={0.01}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.unit_price}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "unit_price",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm w-20"
                          min={0}
                          step={0.01}
                        />
                      </TableCell>
                      <TableCell>
                        {row._expiryOptions &&
                        row._expiryOptions.length > 1 ? (
                          <Select
                            value={row.expiry_date ?? ""}
                            onValueChange={(val) =>
                              updateRow(idx, "expiry_date", val)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs border-amber-500/50">
                              <SelectValue placeholder="Pick date" />
                            </SelectTrigger>
                            <SelectContent>
                              {row._expiryOptions.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type="date"
                            value={row.expiry_date ?? ""}
                            onChange={(e) =>
                              updateRow(idx, "expiry_date", e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.barcode}
                          onChange={(e) =>
                            updateRow(idx, "barcode", e.target.value)
                          }
                          className={`h-8 text-xs font-mono ${row._autoBarcode ? "text-amber-400" : ""}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Error details */}
            {errorRows.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p className="font-medium text-destructive flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Rows with errors (fix above or they&apos;ll be skipped):
                </p>
                <ul className="list-disc pl-4 text-destructive/80 space-y-0.5">
                  {errorRows.slice(0, 5).map((r) => (
                    <li key={r._rowNum}>
                      Row {r._rowNum}: {r._errors.join(", ")}
                    </li>
                  ))}
                  {errorRows.length > 5 && (
                    <li>…and {errorRows.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          {step === "review" && (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
