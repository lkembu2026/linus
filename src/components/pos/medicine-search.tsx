"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchMedicines } from "@/actions/sales";
import { Search, Loader2, Plus, ScanBarcode } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BarcodeScanner } from "./barcode-scanner";

interface SearchResult {
  medicine_id: string;
  name: string;
  generic_name: string | null;
  category: string | null;
  barcode: string | null;
  unit_price: number;
  max_quantity: number;
}

interface MedicineSearchProps {
  onSelect: (item: {
    medicine_id: string;
    name: string;
    unit_price: number;
    max_quantity: number;
  }) => void;
}

export function MedicineSearch({ onSelect }: MedicineSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [showResults, setShowResults] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(
    (value: string) => {
      if (value.length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }
      startTransition(async () => {
        const data = await searchMedicines(value);
        setResults(data);
        setShowResults(true);

        // Auto-select if barcode exact match (single result)
        if (data.length === 1 && data[0].barcode && data[0].barcode === value) {
          onSelect({
            medicine_id: data[0].medicine_id,
            name: data[0].name,
            unit_price: data[0].unit_price,
            max_quantity: data[0].max_quantity,
          });
          setQuery("");
          setResults([]);
          setShowResults(false);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function handleSelect(item: SearchResult) {
    onSelect({
      medicine_id: item.medicine_id,
      name: item.name,
      unit_price: item.unit_price,
      max_quantity: item.max_quantity,
    });
    setQuery("");
    setResults([]);
    setShowResults(false);
  }

  function handleBarcodeScan(barcode: string) {
    setQuery(barcode);
    doSearch(barcode);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.length >= 2) {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search medicine by name, generic name, or barcode..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setShowResults(true)}
            className="pl-10 bg-card border-border focus:border-primary h-12 text-base"
          />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        <Button
          variant="outline"
          className="h-12 px-3 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary shrink-0 gap-2"
          onClick={() => setScannerOpen(true)}
          title="Scan barcode with camera"
        >
          <ScanBarcode className="h-5 w-5" />
          <span className="hidden sm:inline text-sm">Scan</span>
        </Button>
      </div>

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {results.map((item) => (
            <button
              key={item.medicine_id}
              onClick={() => handleSelect(item)}
              className="flex w-full items-center justify-between p-3 text-left hover:bg-primary/5 border-b border-border last:border-0 transition-colors"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.generic_name && (
                    <span className="text-xs text-muted-foreground">
                      {item.generic_name}
                    </span>
                  )}
                  {item.category && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.category}
                    </Badge>
                  )}
                  {item.barcode && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {item.barcode}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">
                    {formatCurrency(item.unit_price)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.max_quantity} in stock
                  </p>
                </div>
                <Plus className="h-4 w-4 text-primary" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults &&
        query.length >= 2 &&
        results.length === 0 &&
        !isPending && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">No medicines found</p>
          </div>
        )}

      {/* Camera Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  );
}
