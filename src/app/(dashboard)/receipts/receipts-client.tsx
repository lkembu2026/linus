"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Receipt,
  Search,
  Printer,
  Eye,
  Download,
  FileText,
} from "lucide-react";
import type { SavedReceipt } from "@/actions/receipts";

interface ReceiptsClientProps {
  receipts: SavedReceipt[];
}

export function ReceiptsClient({ receipts }: ReceiptsClientProps) {
  const [search, setSearch] = useState("");
  const [previewReceipt, setPreviewReceipt] = useState<SavedReceipt | null>(
    null,
  );

  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.receipt_number.toLowerCase().includes(q) ||
      (r.items_summary ?? "").toLowerCase().includes(q) ||
      (r.cashier_name ?? "").toLowerCase().includes(q) ||
      (r.branch_name ?? "").toLowerCase().includes(q)
    );
  });

  function handlePrint(receipt: SavedReceipt) {
    const printWindow = window.open("", "_blank", "width=420,height=750");
    if (!printWindow) return;
    printWindow.document.write(receipt.receipt_html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  function handleDownloadHtml(receipt: SavedReceipt) {
    const blob = new Blob([receipt.receipt_html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${receipt.receipt_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            Receipts
          </h1>
          <p className="text-muted-foreground text-sm">
            View and reprint all saved sale receipts
          </p>
        </div>
        <Badge variant="outline" className="border-primary text-primary">
          <Receipt className="h-3 w-3 mr-1" />
          {receipts.length} receipts
        </Badge>
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by receipt number, medicine, cashier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border focus:border-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Receipts table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Saved Receipts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {search
                  ? "No receipts match your search"
                  : "No receipts saved yet. Receipts are saved automatically when a sale is completed."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">
                      Receipt #
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Items
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Payment
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Cashier
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((receipt) => (
                    <TableRow key={receipt.id} className="border-border">
                      <TableCell className="text-primary font-mono text-xs font-medium">
                        {receipt.receipt_number}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground text-xs max-w-[200px] truncate"
                        title={receipt.items_summary ?? "-"}
                      >
                        {receipt.items_summary || "-"}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {formatCurrency(receipt.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            receipt.payment_method === "mpesa"
                              ? "border-green-500 text-green-500"
                              : "border-blue-400 text-blue-400"
                          }
                        >
                          {receipt.payment_method.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {receipt.cashier_name ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(receipt.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary h-8 w-8 p-0"
                            onClick={() => setPreviewReceipt(receipt)}
                            title="Preview"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary h-8 w-8 p-0"
                            onClick={() => handlePrint(receipt)}
                            title="Print"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-white h-8 w-8 p-0"
                            onClick={() => handleDownloadHtml(receipt)}
                            title="Download HTML"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Preview Dialog */}
      <Dialog
        open={!!previewReceipt}
        onOpenChange={(open) => !open && setPreviewReceipt(null)}
      >
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-white flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              {previewReceipt?.receipt_number}
            </DialogTitle>
          </DialogHeader>
          <div className="px-2 pb-2">
            {previewReceipt && (
              <iframe
                srcDoc={previewReceipt.receipt_html}
                className="w-full rounded-lg border border-border"
                style={{ height: "500px", background: "#0a0a0f" }}
                title="Receipt Preview"
              />
            )}
          </div>
          <div className="flex gap-2 justify-end px-6 pb-6">
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground"
              onClick={() => setPreviewReceipt(null)}
            >
              Close
            </Button>
            {previewReceipt && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary"
                  onClick={() => handleDownloadHtml(previewReceipt)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  onClick={() => handlePrint(previewReceipt)}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Print
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
