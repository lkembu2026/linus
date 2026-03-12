"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MedicineFormDialog } from "@/components/inventory/medicine-form-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { BarcodeLabelDialog } from "@/components/inventory/barcode-label-dialog";
import { ImportMedicinesDialog } from "@/components/inventory/import-medicines-dialog";
import { BulkOpeningStockDialog } from "@/components/inventory/bulk-opening-stock-dialog";
import { ScanInvoiceDialog } from "@/components/inventory/scan-invoice-dialog";
import {
  getMedicines,
  deleteMedicine,
  syncCatalogAcrossBranches,
  getCatalogSyncStatus,
} from "@/actions/inventory";
import { usePermissions } from "@/hooks/use-permissions";
import { useMode } from "@/contexts/mode-context";
import { formatCurrency, formatDate, exportToCSV } from "@/lib/utils";
import { MEDICINE_CATEGORIES, BEAUTY_CATEGORIES } from "@/lib/constants";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  Pill,
  Download,
  ScanBarcode,
  ScanLine,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { AppMode } from "@/types";
import type { User, Medicine } from "@/types/database";

interface InventoryClientProps {
  user: User & { branch?: { name: string } | null };
  initialMedicines: InventoryMedicine[];
}

type InventoryMedicine = Medicine & {
  branch?: { name: string } | null;
  brand?: string | null;
  size?: string | null;
  colour?: string | null;
};

const modeCategoriesMap = {
  pharmacy: [...MEDICINE_CATEGORIES],
  beauty: [...BEAUTY_CATEGORIES],
} as const;

export function InventoryClient({
  user,
  initialMedicines,
}: InventoryClientProps) {
  const { can } = usePermissions(user.role);
  const { mode } = useMode();
  const modeCategories = modeCategoriesMap[mode];
  const itemLabel = mode === "beauty" ? "Product" : "Medicine";
  const cachedByModeRef = useRef<
    Record<AppMode, InventoryMedicine[] | undefined>
  >({
    pharmacy: mode === "pharmacy" ? initialMedicines : undefined,
    beauty: mode === "beauty" ? initialMedicines : undefined,
  });
  const requestIdRef = useRef(0);
  const [medicines, setMedicines] =
    useState<InventoryMedicine[]>(initialMedicines);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editMedicine, setEditMedicine] = useState<Medicine | null>(null);
  const [adjustMedicine, setAdjustMedicine] = useState<Medicine | null>(null);
  const [labelMedicine, setLabelMedicine] = useState<Medicine | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [bulkStockOpen, setBulkStockOpen] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [isLoadingSyncStatus, setIsLoadingSyncStatus] = useState(false);
  const [isModeLoading, setIsModeLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    totalUniqueProducts: number;
    branchCount: number;
    expectedCopies: number;
    actualCopies: number;
    missingBranchCopies: number;
    coveragePercent: number;
    synced: boolean;
  } | null>(null);
  const [, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const totalPages = Math.ceil(medicines.length / PAGE_SIZE);
  const pagedMedicines = medicines.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  async function loadModeMedicines(targetMode: AppMode) {
    return getMedicines(undefined, undefined, [
      ...modeCategoriesMap[targetMode],
    ]);
  }

  // Re-fetch the correct product list whenever mode changes
  useEffect(() => {
    setSearch("");
    setCategory("");
    setPage(1);
    const cached = cachedByModeRef.current[mode];
    const oppositeMode: AppMode = mode === "pharmacy" ? "beauty" : "pharmacy";
    if (cached) {
      setMedicines(cached);
      setIsModeLoading(false);
      if (!cachedByModeRef.current[oppositeMode]) {
        loadModeMedicines(oppositeMode)
          .then((prefetched) => {
            cachedByModeRef.current[oppositeMode] = prefetched;
          })
          .catch(() => {});
      }
      return;
    }

    setIsModeLoading(true);

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    // NOTE: do NOT wrap in startTransition here — async state updates
    // after await inside startTransition are silently dropped in React 19.
    loadModeMedicines(mode)
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        cachedByModeRef.current[mode] = data;
        setMedicines(data);
        setIsModeLoading(false);
        if (!cachedByModeRef.current[oppositeMode]) {
          loadModeMedicines(oppositeMode)
            .then((prefetched) => {
              cachedByModeRef.current[oppositeMode] = prefetched;
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setIsModeLoading(false);
      });
  }, [mode]);

  function handleSearch(searchTerm: string, cat: string) {
    startTransition(async () => {
      const data = await getMedicines(
        searchTerm || undefined,
        cat || undefined,
        // When no specific category is selected, limit to the current mode's categories
        cat ? undefined : [...modeCategories],
      );
      setMedicines(data);
    });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    handleSearch(value, category);
  }

  function handleCategoryChange(value: string) {
    const cat = value === "all" ? "" : value;
    setCategory(cat);
    setPage(1);
    handleSearch(search, cat);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const result = await deleteMedicine(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${itemLabel} deleted`);
    setMedicines((prev) => {
      const next = prev.filter((m) => m.id !== id);
      cachedByModeRef.current[mode] = next;
      return next;
    });
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditMedicine(null);
    // Refresh
    handleSearch(search, category);
  }

  function handleAdjustClose() {
    setAdjustMedicine(null);
    handleSearch(search, category);
  }

  async function loadSyncStatus() {
    if (user.role !== "admin") return;
    setIsLoadingSyncStatus(true);
    const result = await getCatalogSyncStatus();
    setIsLoadingSyncStatus(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setSyncStatus({
      totalUniqueProducts: result.totalUniqueProducts,
      branchCount: result.branchCount,
      expectedCopies: result.expectedCopies,
      actualCopies: result.actualCopies,
      missingBranchCopies: result.missingBranchCopies,
      coveragePercent: result.coveragePercent,
      synced: result.synced,
    });
  }

  useEffect(() => {
    loadSyncStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  async function handleSyncCatalog() {
    if (
      !confirm(
        "Sync all existing medicines/products to every branch? Missing branch copies will be created with stock 0.",
      )
    ) {
      return;
    }

    setIsSyncingCatalog(true);
    const result = await syncCatalogAcrossBranches();
    setIsSyncingCatalog(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      result.created > 0
        ? `Catalog sync complete: ${result.created} branch item(s) added.`
        : "Catalog already synced across branches.",
    );

    cachedByModeRef.current.pharmacy = undefined;
    cachedByModeRef.current.beauty = undefined;

    const refreshed = await getMedicines(
      search || undefined,
      category || undefined,
      category ? undefined : [...modeCategories],
    );
    cachedByModeRef.current[mode] = refreshed;
    setMedicines(refreshed);
    await loadSyncStatus();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            {mode === "beauty" ? "Beauty & Clothing" : "Inventory"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {medicines.length} {itemLabel.toLowerCase()}s •{" "}
            {user.branch?.name ?? "All Branches"}
          </p>
          {isModeLoading && (
            <p className="text-xs text-muted-foreground mt-1">
              Refreshing data...
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outline"
            className="border-border text-muted-foreground"
            onClick={() =>
              exportToCSV(
                medicines.map((m) => ({
                  name: m.name,
                  generic_name: m.generic_name ?? "",
                  category: m.category,
                  unit_price: m.unit_price,
                  quantity_in_stock: m.quantity_in_stock,
                  barcode: m.barcode ?? "",
                  branch: m.branch?.name ?? "",
                  expiry_date: m.expiry_date ?? "",
                })),
                "inventory-export",
                [
                  { key: "name", label: "Name" },
                  { key: "generic_name", label: "Generic Name" },
                  { key: "category", label: "Category" },
                  { key: "unit_price", label: "Unit Price" },
                  { key: "quantity_in_stock", label: "Stock" },
                  { key: "barcode", label: "Barcode" },
                  { key: "branch", label: "Branch" },
                  { key: "expiry_date", label: "Expiry Date" },
                ],
              )
            }
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {can("import_medicines") && (
            <Button
              variant="outline"
              onClick={() => setScanOpen(true)}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <ScanLine className="h-4 w-4 mr-2" />
              Scan Invoice
            </Button>
          )}
          {can("import_medicines") && (
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          )}
          {can("bulk_opening_stock") && (
            <Button
              variant="outline"
              onClick={() => setBulkStockOpen(true)}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <Package className="h-4 w-4 mr-2" />
              Set Opening Stock
            </Button>
          )}
          {can("sync_catalog") && (
            <Button
              variant="outline"
              onClick={handleSyncCatalog}
              disabled={isSyncingCatalog}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              {isSyncingCatalog ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync All Branches
            </Button>
          )}
          {can("add_medicine") && (
            <Button
              onClick={() => setFormOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {itemLabel}
            </Button>
          )}
        </div>
      </div>

      {can("sync_catalog") && (
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground">
                  Catalog Sync Status
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Checks if each product exists in every branch (stock remains
                  branch-specific).
                </p>
              </div>

              <Badge
                variant="outline"
                className={
                  syncStatus?.synced
                    ? "border-green-500 text-green-400"
                    : "border-amber-500 text-amber-400"
                }
              >
                {isLoadingSyncStatus
                  ? "Checking..."
                  : syncStatus?.synced
                    ? "Fully Synced"
                    : "Needs Sync"}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground text-xs">Unique Products</p>
                <p className="text-white text-lg font-semibold">
                  {syncStatus?.totalUniqueProducts ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground text-xs">Branches</p>
                <p className="text-white text-lg font-semibold">
                  {syncStatus?.branchCount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground text-xs">Missing Copies</p>
                <p className="text-white text-lg font-semibold">
                  {syncStatus?.missingBranchCopies ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground text-xs">Coverage</p>
                <p className="text-white text-lg font-semibold">
                  {syncStatus?.coveragePercent ?? 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search by name${mode === "beauty" ? ", brand" : ", generic name"}, or barcode...`}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-background border-border text-white"
              />
            </div>
            <Select
              value={category || "all"}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full sm:w-48 bg-background border-border text-white">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem
                  value="all"
                  className="text-white focus:bg-primary/10"
                >
                  All Categories
                </SelectItem>
                {modeCategories.map((cat) => (
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
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" />
            {mode === "beauty" ? "Products Catalog" : "Medicine Catalog"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {medicines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No {itemLabel.toLowerCase()}s found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">
                      Name
                    </TableHead>
                    {mode === "beauty" && (
                      <TableHead className="text-muted-foreground">
                        Brand / Size
                      </TableHead>
                    )}
                    <TableHead className="text-muted-foreground">
                      Category
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right">
                      Price
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right hidden md:table-cell">
                      Cost
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right">
                      Stock
                    </TableHead>
                    <TableHead className="text-muted-foreground hidden lg:table-cell">
                      Expiry
                    </TableHead>
                    {(user.role === "admin" || user.role === "super_admin") && (
                      <TableHead className="text-muted-foreground hidden md:table-cell">
                        Branch
                      </TableHead>
                    )}
                    <TableHead className="text-muted-foreground text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedMedicines.map((med) => {
                    const isLow = med.quantity_in_stock <= med.reorder_level;
                    const isExpired =
                      med.expiry_date && new Date(med.expiry_date) < new Date();
                    const isExpiringSoon =
                      med.expiry_date &&
                      !isExpired &&
                      new Date(med.expiry_date) <
                        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

                    return (
                      <TableRow key={med.id} className="border-border">
                        <TableCell>
                          <div>
                            <p className="text-white font-medium">{med.name}</p>
                            {med.generic_name && (
                              <p className="text-xs text-muted-foreground">
                                {med.generic_name}
                              </p>
                            )}
                            {med.requires_prescription &&
                              mode === "pharmacy" && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500 text-amber-500 text-xs mt-1"
                                >
                                  Rx
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        {mode === "beauty" && (
                          <TableCell>
                            <div className="text-xs">
                              {med.brand && (
                                <p className="text-white">{med.brand}</p>
                              )}
                              {med.size && (
                                <p className="text-muted-foreground">
                                  {med.size}
                                </p>
                              )}
                              {med.colour && (
                                <p className="text-primary/70">{med.colour}</p>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-border text-muted-foreground"
                          >
                            {med.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-primary font-medium">
                          {formatCurrency(med.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground hidden md:table-cell">
                          {formatCurrency(med.cost_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              isLow
                                ? "text-destructive font-medium"
                                : "text-white"
                            }
                          >
                            {med.quantity_in_stock}
                          </span>
                          {isLow && (
                            <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-500" />
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {med.expiry_date ? (
                            <span
                              className={
                                isExpired
                                  ? "text-destructive"
                                  : isExpiringSoon
                                    ? "text-amber-500"
                                    : "text-muted-foreground"
                              }
                            >
                              {formatDate(med.expiry_date)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {(user.role === "admin" || user.role === "super_admin") && (
                          <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                            {med.branch?.name ?? "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-card border-border"
                            >
                              {can("edit_medicine") && (
                                <>
                                  <DropdownMenuItem
                                    className="text-white focus:bg-primary/10 cursor-pointer"
                                    onClick={() => {
                                      setEditMedicine(med);
                                      setFormOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-white focus:bg-primary/10 cursor-pointer"
                                    onClick={() => setLabelMedicine(med)}
                                  >
                                    <ScanBarcode className="h-4 w-4 mr-2" />
                                    Print Barcode Label
                                  </DropdownMenuItem>
                                </>
                              )}
                              {can("adjust_stock") && (
                                <DropdownMenuItem
                                  className="text-white focus:bg-primary/10 cursor-pointer"
                                  onClick={() => setAdjustMedicine(med)}
                                >
                                  <Package className="h-4 w-4 mr-2" />
                                  Adjust Stock
                                </DropdownMenuItem>
                              )}
                              {(user.role === "admin" || user.role === "super_admin") && (
                                <DropdownMenuItem
                                  className="text-destructive focus:bg-destructive/10 cursor-pointer"
                                  onClick={() => handleDelete(med.id, med.name)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({medicines.length} items)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground h-8"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground h-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <MedicineFormDialog
        open={formOpen}
        onClose={handleFormClose}
        medicine={editMedicine}
        mode={mode}
      />
      <StockAdjustDialog
        open={!!adjustMedicine}
        onClose={handleAdjustClose}
        medicine={adjustMedicine}
      />
      <BarcodeLabelDialog
        open={!!labelMedicine}
        onClose={() => setLabelMedicine(null)}
        medicine={labelMedicine}
        onBarcodeGenerated={(medicineId, barcode) => {
          setMedicines((prev) =>
            prev.map((m) => (m.id === medicineId ? { ...m, barcode } : m)),
          );
        }}
      />
      <ImportMedicinesDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          const data = await getMedicines(
            search || undefined,
            category || undefined,
            category ? undefined : [...modeCategories],
          );
          setMedicines(data);
        }}
      />
      <BulkOpeningStockDialog
        open={bulkStockOpen}
        onClose={() => setBulkStockOpen(false)}
        onApplied={async () => {
          const data = await getMedicines(
            search || undefined,
            category || undefined,
            category ? undefined : [...modeCategories],
          );
          setMedicines(data);
        }}
      />
      <ScanInvoiceDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onImportComplete={async () => {
          const data = await getMedicines(
            search || undefined,
            category || undefined,
            category ? undefined : [...modeCategories],
          );
          cachedByModeRef.current[mode] = data;
          setMedicines(data);
        }}
      />
    </div>
  );
}
