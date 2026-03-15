"use client";

import { useState } from "react";
import { Package, Search } from "lucide-react";
import type { Medicine } from "@/types/database";
import type { AppMode } from "@/types";

interface StockLevelsTableProps {
  medicines: Medicine[];
  mode?: AppMode;
}

function getStockStatus(med: Medicine) {
  if (med.quantity_in_stock === 0)
    return {
      label: "Out of Stock",
      color: "text-red-400",
      bg: "bg-red-400/10 border-red-400/20",
    };
  if (med.quantity_in_stock <= med.reorder_level)
    return {
      label: "Low Stock",
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
    };
  return {
    label: "In Stock",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  };
}

export function StockLevelsTable({
  medicines,
  mode = "pharmacy",
}: StockLevelsTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");
  const titleLabel = mode === "beauty" ? "Product" : "Medicine";

  const filtered = medicines.filter((med) => {
    const matchesSearch =
      !search ||
      med.name.toLowerCase().includes(search.toLowerCase()) ||
      med.category.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "out_of_stock") return med.quantity_in_stock === 0;
    if (filter === "low_stock")
      return (
        med.quantity_in_stock > 0 && med.quantity_in_stock <= med.reorder_level
      );
    if (filter === "in_stock") return med.quantity_in_stock > med.reorder_level;
    return true;
  });

  const filterButtons = [
    { key: "all" as const, label: "All", count: medicines.length },
    {
      key: "in_stock" as const,
      label: "In Stock",
      count: medicines.filter((m) => m.quantity_in_stock > m.reorder_level)
        .length,
    },
    {
      key: "low_stock" as const,
      label: "Low",
      count: medicines.filter(
        (m) =>
          m.quantity_in_stock > 0 && m.quantity_in_stock <= m.reorder_level,
      ).length,
    },
    {
      key: "out_of_stock" as const,
      label: "Out",
      count: medicines.filter((m) => m.quantity_in_stock === 0).length,
    },
  ];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold font-[family-name:var(--font-sans)] text-white">
          All {titleLabel} <span className="text-primary">Stock Levels</span>
        </h3>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${titleLabel.toLowerCase()}s...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1">
          {filterButtons.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filter === key
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-background/50 border-border text-muted-foreground hover:text-white"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No {titleLabel.toLowerCase()}s found
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-background/80 backdrop-blur-sm border-b border-border">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  Category
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Stock
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  Reorder Level
                </th>
                <th className="text-center py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((med) => {
                const status = getStockStatus(med);
                return (
                  <tr
                    key={med.id}
                    className="hover:bg-background/30 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <p className="text-white font-medium leading-tight break-words">
                        {med.name}
                      </p>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        {med.category}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                      {med.category}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-bold ${
                          med.quantity_in_stock === 0
                            ? "text-red-400"
                            : med.quantity_in_stock <= med.reorder_level
                              ? "text-amber-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {med.quantity_in_stock}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground hidden sm:table-cell">
                      {med.reorder_level}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full border ${status.bg} ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
