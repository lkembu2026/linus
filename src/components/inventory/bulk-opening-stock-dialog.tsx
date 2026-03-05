"use client";

import { useRef, useState } from "react";
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
import { bulkSetOpeningStock } from "@/actions/inventory";

const TEMPLATE_COLUMNS = ["barcode", "name", "quantity"];

const COLUMN_HINTS: Record<string, string> = {
  barcode: "Preferred (exact match)",
  name: "Used if barcode is blank",
  quantity: "0 or greater",
};

type ParsedRow = {
  barcode?: string;
  name?: string;
  quantity: number;
  _rowNum: number;
  _errors: string[];
};

function parseRow(raw: Record<string, unknown>, rowNum: number): ParsedRow {
  const errors: string[] = [];

  const barcode = String(raw["barcode"] ?? "").trim() || undefined;
  const name = String(raw["name"] ?? "").trim() || undefined;

  if (!barcode && !name) {
    errors.push("barcode or name is required");
  }

  const quantityRaw = String(raw["quantity"] ?? "").trim();
  const quantity = Number(quantityRaw);

  if (!quantityRaw || !Number.isFinite(quantity) || quantity < 0) {
    errors.push("quantity must be 0 or greater");
  }

  return {
    barcode,
    name,
    quantity: Number.isFinite(quantity) ? Math.floor(quantity) : 0,
    _rowNum: rowNum,
    _errors: errors,
  };
}

interface BulkOpeningStockDialogProps {
  open: boolean;
  onClose: () => void;
  onApplied: () => Promise<void> | void;
}

export function BulkOpeningStockDialog({
  open,
  onClose,
  onApplied,
}: BulkOpeningStockDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [applying, setApplying] = useState(false);

  const validRows = rows.filter((row) => row._errors.length === 0);
  const errorRows = rows.filter((row) => row._errors.length > 0);

  function downloadTemplate(format: "csv" | "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      TEMPLATE_COLUMNS.map((col) => COLUMN_HINTS[col] ?? ""),
      ["1234567890123", "Paracetamol 500mg", "120"],
    ]);

    ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 28 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OpeningStock");

    if (format === "xlsx") {
      XLSX.writeFile(wb, "opening_stock_template.xlsx");
    } else {
      XLSX.writeFile(wb, "opening_stock_template.csv", { bookType: "csv" });
    }
  }

  function handleFile(file: File) {
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
        defval: "",
      });

      const dataRows = rawRows.filter((row) => {
        const barcode = String(row["barcode"] ?? "").trim().toLowerCase();
        const name = String(row["name"] ?? "").trim().toLowerCase();

        return (
          barcode !== "barcode" &&
          name !== "name" &&
          !barcode.includes("preferred") &&
          !name.includes("used if")
        );
      });

      setRows(dataRows.map((row, i) => parseRow(row, i + 2)));
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleApply() {
    if (validRows.length === 0) return;

    setApplying(true);

    const payload = validRows.map(({ barcode, name, quantity }) => ({
      barcode,
      name,
      quantity,
    }));

    const result = await bulkSetOpeningStock(payload);

    setApplying(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const summary = result as {
      updated?: number;
      failed?: number;
      errors?: string[];
    };

    const updated = summary.updated ?? 0;
    const failed = summary.failed ?? 0;

    if (failed > 0) {
      toast.warning(
        `Applied ${updated} row(s), ${failed} failed. Check file values (barcode recommended).`,
      );
    } else {
      toast.success(`Opening stock applied for ${updated} item(s).`);
    }

    if (summary.errors?.length) {
      toast.info(summary.errors.slice(0, 3).join(" | "));
    }

    setRows([]);
    setFileName("");
    await onApplied();
    onClose();
  }

  function handleDialogClose() {
    setRows([]);
    setFileName("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDialogClose()}>
      <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white font-[family-name:var(--font-sans)] flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Set Opening Stock in Bulk
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
            <p className="text-sm font-medium text-white">Step 1 — Download template</p>
            <p className="text-xs text-muted-foreground">
              Fill barcode + quantity. If barcode is missing, the system tries name match.
              Updates apply to the currently selected branch only.
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
            <p className="text-sm font-medium text-white">Step 2 — Upload filled file</p>
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
              {fileName && <p className="text-xs text-primary mt-1">{fileName}</p>}
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

          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-green-500 text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {validRows.length} ready
                </Badge>
                {errorRows.length > 0 && (
                  <Badge
                    variant="outline"
                    className="border-destructive text-destructive"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {errorRows.length} invalid row(s)
                  </Badge>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">#</TableHead>
                      <TableHead className="text-muted-foreground">Barcode</TableHead>
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Quantity</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
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
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.barcode ?? "—"}
                        </TableCell>
                        <TableCell className="text-white text-sm">{row.name ?? "—"}</TableCell>
                        <TableCell className="text-white text-sm">{row.quantity}</TableCell>
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
            onClick={handleDialogClose}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={validRows.length === 0 || applying}
            className="bg-primary text-primary-foreground hover:bg-[#00B8A9] gap-2"
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Apply Opening Stock ({validRows.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
