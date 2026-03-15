"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Camera,
  Upload,
  Loader2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ScanLine,
  FileImage,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { bulkCreateMedicines } from "@/actions/inventory";
import { MEDICINE_CATEGORIES } from "@/lib/constants";
import {
  parseInvoiceText,
  type InvoiceMedicineRow,
} from "@/lib/ocr/parse-invoice";

type Step = "capture" | "camera" | "processing" | "review";

interface ScanInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

function generateBarcode(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `MED${ts}${rand}`;
}

export function ScanInvoiceDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ScanInvoiceDialogProps) {
  const [step, setStep] = useState<Step>("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [rows, setRows] = useState<InvoiceMedicineRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream when leaving camera step or closing dialog
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  function reset() {
    stopCamera();
    setStep("capture");
    setImagePreview(null);
    setOcrProgress(0);
    setOcrStatus("");
    setRows([]);
    setImporting(false);
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  }

  // Open the live camera viewfinder
  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setStep("camera");
      // Attach stream to video element after React renders
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      // Camera not available — fall back to file picker
      toast.info("Camera not available — please upload an image instead");
      fileInputRef.current?.click();
    }
  }

  // Capture a frame from the live camera
  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    stopCamera();

    canvas.toBlob(
      (blob) => {
        if (blob) processImage(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  const processImage = useCallback(async (file: File | Blob) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setStep("processing");
    setOcrStatus("Loading OCR engine…");
    setOcrProgress(5);

    try {
      // Dynamic import to keep bundle lean
      const Tesseract = await import("tesseract.js");

      setOcrStatus("Recognising text…");
      setOcrProgress(15);

      const result = await Tesseract.recognize(file, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setOcrProgress(15 + Math.round(m.progress * 80));
            setOcrStatus("Recognising text…");
          } else if (m.status === "loading language traineddata") {
            setOcrStatus("Loading language data…");
            setOcrProgress(10);
          }
        },
      });

      setOcrProgress(95);
      setOcrStatus("Parsing invoice…");

      const ocrText = result.data.text;
      const parsed = parseInvoiceText(ocrText);

      setOcrProgress(100);

      if (parsed.length === 0) {
        toast.error(
          "Could not extract any medicine data from this image. Try a clearer photo or enter items manually.",
        );
        setStep("capture");
        return;
      }

      setRows(parsed);
      setStep("review");
      toast.success(`Found ${parsed.length} medicine(s) on the invoice`);
    } catch (err) {
      console.error("OCR error:", err);
      toast.error("Failed to process image. Please try again.");
      setStep("capture");
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept image or PDF
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please select an image (JPG, PNG) or PDF file");
      return;
    }

    // For PDF files, we'll still pass to Tesseract (it handles images)
    // but notify user that image works best
    if (file.type === "application/pdf") {
      toast.info(
        "PDF detected — for best results, take a photo of the invoice instead",
      );
    }

    processImage(file);
    // Reset file input so same file can be re-selected
    e.target.value = "";
  }

  function updateRow(
    index: number,
    field: keyof InvoiceMedicineRow,
    value: string | number,
  ) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    if (rows.length === 0) {
      toast.error("No items to import");
      return;
    }

    // Validate all rows have names
    const invalid = rows.filter((r) => !r.name.trim());
    if (invalid.length > 0) {
      toast.error("Some rows are missing a medicine name");
      return;
    }

    setImporting(true);

    const medicines = rows.map((row) => ({
      name: row.name.trim(),
      generic_name: "",
      category: row.category,
      unit_price: row.costPrice, // Selling price defaults to cost; user can adjust later
      cost_price: row.costPrice,
      quantity_in_stock: row.quantity,
      reorder_level: 10,
      expiry_date: row.expiryDate || undefined,
      barcode: row.batchNo || generateBarcode(),
      dispensing_unit: undefined,
      requires_prescription: false,
    }));

    const result = await bulkCreateMedicines(medicines);

    setImporting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Successfully imported ${medicines.length} medicine(s)`);
    onImportComplete();
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={
          step === "review"
            ? "max-w-5xl max-h-[90vh] flex flex-col"
            : step === "camera"
              ? "max-w-md max-h-[90vh]"
              : "max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            {step === "capture" && "Scan Supplier Invoice"}
            {step === "camera" && "Point at Invoice"}
            {step === "processing" && "Processing Invoice…"}
            {step === "review" && "Review Scanned Items"}
          </DialogTitle>
          <DialogDescription>
            {step === "capture" &&
              "Take a photo of the supplier invoice or upload an image to automatically extract medicine data."}
            {step === "camera" &&
              "Position the invoice in the frame so all text is clear and readable."}
            {step === "processing" &&
              "Reading the invoice using OCR. This may take a moment…"}
            {step === "review" &&
              "Review and edit the extracted data below before importing. Fix any OCR errors."}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step 1: Capture ─── */}
        {step === "capture" && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Camera capture — opens live viewfinder */}
              <Button
                variant="outline"
                className="h-28 flex-col gap-2 border-dashed border-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5"
                onClick={openCamera}
              >
                <Camera className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium">Take Photo</span>
                <span className="text-xs text-muted-foreground">
                  Open camera
                </span>
              </Button>

              {/* File upload */}
              <Button
                variant="outline"
                className="h-28 flex-col gap-2 border-dashed border-2 border-border hover:border-primary/40 hover:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileImage className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Upload Image</span>
                <span className="text-xs text-muted-foreground">
                  JPG, PNG, or PDF
                </span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                Tips for best results
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Place invoice on a flat surface with good lighting</li>
                <li>Avoid shadows and folded corners</li>
                <li>Ensure all text is sharp and readable</li>
                <li>You can always edit extracted data before importing</li>
              </ul>
            </div>
          </div>
        )}

        {/* ─── Step 1b: Live Camera Viewfinder ─── */}
        {step === "camera" && (
          <div className="space-y-3 py-2">
            <div className="relative w-full aspect-[3/4] max-h-[60vh] rounded-lg overflow-hidden border border-border bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Position the invoice so all text is visible, then tap Capture
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  stopCamera();
                  setStep("capture");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-[#00B8A9]"
                onClick={capturePhoto}
              >
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Processing ─── */}
        {step === "processing" && (
          <div className="space-y-6 py-8">
            {imagePreview && (
              <div className="relative mx-auto w-48 h-48 rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Invoice preview"
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ocrStatus}</span>
                <span className="text-primary font-medium">{ocrProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Review & Edit ─── */}
        {step === "review" && (
          <div className="flex-1 min-h-0 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {rows.length} item{rows.length !== 1 ? "s" : ""} found
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("capture");
                  setRows([]);
                }}
                className="text-xs text-muted-foreground"
              >
                <Camera className="h-3.5 w-3.5 mr-1" />
                Scan Again
              </Button>
            </div>

            <ScrollArea className="h-[50vh] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8 text-center">#</TableHead>
                    <TableHead className="min-w-[200px]">
                      Medicine Name
                    </TableHead>
                    <TableHead className="w-[120px]">Batch No</TableHead>
                    <TableHead className="w-[70px]">Qty</TableHead>
                    <TableHead className="w-[120px]">Expiry Date</TableHead>
                    <TableHead className="w-[100px]">Cost Price</TableHead>
                    <TableHead className="w-[130px]">Category</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
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
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.batchNo}
                          onChange={(e) =>
                            updateRow(idx, "batchNo", e.target.value)
                          }
                          className="h-8 text-sm font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "quantity",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm w-16"
                          min={0}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.expiryDate}
                          onChange={(e) =>
                            updateRow(idx, "expiryDate", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.costPrice}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "costPrice",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 text-sm w-20"
                          min={0}
                          step={0.01}
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
                            {MEDICINE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeRow(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No items to import. Scan another invoice.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 inline mr-1 text-yellow-500" />
              Review all fields carefully — OCR may misread some characters.
              Selling price defaults to cost price; you can adjust later in
              inventory.
            </p>
          </div>
        )}

        {/* ─── Footer ─── */}
        {step === "review" && (
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || rows.length === 0}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Import {rows.length} Item{rows.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
