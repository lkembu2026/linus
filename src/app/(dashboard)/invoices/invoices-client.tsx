"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getImportInvoices } from "@/actions/invoices";
import { formatDateTime } from "@/lib/utils";
import {
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Package,
} from "lucide-react";

interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
  category: string;
  barcode: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  invoice_date: string | null;
  file_name: string;
  import_format: string;
  items_count: number;
  inserted: number;
  updated: number;
  total_value: number;
  items: InvoiceItem[];
  imported_by_name: string;
  created_at: string;
}

interface InvoicesClientProps {
  initialInvoices: Invoice[];
  initialTotal: number;
}

const FORMAT_LABELS: Record<string, { label: string; color: string }> = {
  template: {
    label: "Template",
    color: "border-blue-500 text-blue-500",
  },
  "lk-invoice": {
    label: "LK Invoice",
    color: "border-green-500 text-green-500",
  },
  "small-invoice": {
    label: "Small Invoice",
    color: "border-amber-500 text-amber-500",
  },
};

export function InvoicesClient({
  initialInvoices,
  initialTotal,
}: InvoicesClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  function loadPage(newPage: number) {
    startTransition(async () => {
      const result = await getImportInvoices(newPage, pageSize);
      setInvoices(result.invoices as Invoice[]);
      setTotal(result.total);
      setPage(newPage);
    });
  }

  function formatCurrency(amount: number) {
    return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-sans)] flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Invoice Tracking
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track all CSV/Excel imports with full details
          </p>
        </div>
        <Badge variant="outline" className="border-primary text-primary">
          {total} import{total !== 1 ? "s" : ""}
        </Badge>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No imports yet</p>
              <p className="text-sm">
                Import medicines via CSV/Excel from the Inventory page
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Invoice #</TableHead>
                      <TableHead className="text-muted-foreground">Supplier</TableHead>
                      <TableHead className="text-muted-foreground">File</TableHead>
                      <TableHead className="text-muted-foreground">Format</TableHead>
                      <TableHead className="text-muted-foreground text-right">Items</TableHead>
                      <TableHead className="text-muted-foreground text-right">New</TableHead>
                      <TableHead className="text-muted-foreground text-right">Updated</TableHead>
                      <TableHead className="text-muted-foreground text-right">Value</TableHead>
                      <TableHead className="text-muted-foreground">By</TableHead>
                      <TableHead className="text-muted-foreground w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const fmt = FORMAT_LABELS[inv.import_format] ?? {
                        label: inv.import_format,
                        color: "border-muted-foreground text-muted-foreground",
                      };
                      return (
                        <TableRow key={inv.id} className="border-border">
                          <TableCell className="text-white text-xs whitespace-nowrap">
                            {formatDateTime(inv.created_at)}
                          </TableCell>
                          <TableCell className="text-white text-sm">
                            {inv.invoice_number || "—"}
                          </TableCell>
                          <TableCell className="text-white text-sm max-w-[150px] truncate">
                            {inv.supplier_name || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">
                            {inv.file_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={fmt.color}>
                              {fmt.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white text-right">
                            {inv.items_count}
                          </TableCell>
                          <TableCell className="text-green-400 text-right">
                            {inv.inserted}
                          </TableCell>
                          <TableCell className="text-blue-400 text-right">
                            {inv.updated}
                          </TableCell>
                          <TableCell className="text-white text-right text-xs whitespace-nowrap">
                            {formatCurrency(inv.total_value)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {inv.imported_by_name}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-white"
                              onClick={() => setSelectedInvoice(inv)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isPending}
                      onClick={() => loadPage(page - 1)}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronLeft className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || isPending}
                      onClick={() => loadPage(page + 1)}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog
        open={!!selectedInvoice}
        onOpenChange={(v) => !v && setSelectedInvoice(null)}
      >
        <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white font-[family-name:var(--font-sans)] flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Invoice Details
              {selectedInvoice?.invoice_number && (
                <Badge variant="outline" className="border-primary text-primary ml-2">
                  #{selectedInvoice.invoice_number}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p className="text-sm text-white font-medium">
                    {selectedInvoice.supplier_name || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Invoice Date</p>
                  <p className="text-sm text-white font-medium">
                    {selectedInvoice.invoice_date || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total Value</p>
                  <p className="text-sm text-white font-medium">
                    {formatCurrency(selectedInvoice.total_value)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Imported</p>
                  <p className="text-sm text-white font-medium">
                    {formatDateTime(selectedInvoice.created_at)}
                  </p>
                </div>
              </div>

              {/* Items list */}
              <ScrollArea className="flex-1 rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">#</TableHead>
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Category</TableHead>
                      <TableHead className="text-muted-foreground text-right">Qty</TableHead>
                      <TableHead className="text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-muted-foreground">Barcode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedInvoice.items ?? []).map(
                      (item: InvoiceItem, idx: number) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell className="text-muted-foreground text-xs">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="text-white text-sm">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="border-muted-foreground text-muted-foreground text-xs"
                            >
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white text-right">
                            {item.qty}
                          </TableCell>
                          <TableCell className="text-white text-right">
                            {formatCurrency(item.price)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {item.barcode || "—"}
                          </TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <span>
                  File: {selectedInvoice.file_name} • Format:{" "}
                  {FORMAT_LABELS[selectedInvoice.import_format]?.label ??
                    selectedInvoice.import_format}
                </span>
                <span>
                  {selectedInvoice.inserted} new, {selectedInvoice.updated}{" "}
                  updated • By {selectedInvoice.imported_by_name}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
