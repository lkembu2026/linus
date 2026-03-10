"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/actions/auth";
import { revalidatePath } from "next/cache";
import { sendAuditEmail, sendLowStockEmail } from "@/lib/email";
import { getEffectiveBranchId } from "@/lib/branch-server";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import type { Database, Medicine } from "@/types/database";

type MedicineInsert = Database["public"]["Tables"]["medicines"]["Insert"];

function normalizeText(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeKeyText(value?: string | null) {
  return normalizeText(value ?? undefined)?.toLowerCase() ?? "";
}

function buildMedicineIdentityKey(item: {
  name: string;
  generic_name?: string | null;
  category: string;
  barcode?: string | null;
  dispensing_unit?: string | null;
  requires_prescription: boolean;
  brand?: string | null;
  size?: string | null;
  colour?: string | null;
}) {
  const barcode = normalizeKeyText(item.barcode);
  if (barcode) {
    return `barcode:${barcode}`;
  }

  return [
    normalizeKeyText(item.name),
    normalizeKeyText(item.category),
    normalizeKeyText(item.generic_name),
    normalizeKeyText(item.dispensing_unit),
    normalizeKeyText(item.brand),
    normalizeKeyText(item.size),
    normalizeKeyText(item.colour),
    item.requires_prescription ? "1" : "0",
  ].join("|");
}

async function findExistingBranchesForItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchIds: string[],
  item: {
    name: string;
    generic_name?: string;
    category: string;
    barcode?: string;
    dispensing_unit?: string;
    requires_prescription: boolean;
    brand?: string;
    size?: string;
    colour?: string;
  },
) {
  if (branchIds.length === 0) return new Set<string>();

  let query = supabase
    .from("medicines")
    .select("branch_id")
    .in("branch_id", branchIds)
    .eq("name", item.name)
    .eq("category", item.category)
    .eq("requires_prescription", item.requires_prescription);

  const barcode = normalizeText(item.barcode);

  if (barcode) {
    query = query.eq("barcode", barcode);
  } else {
    const genericName = normalizeText(item.generic_name);
    const dispensingUnit = normalizeText(item.dispensing_unit);
    const brand = normalizeText(item.brand);
    const size = normalizeText(item.size);
    const colour = normalizeText(item.colour);

    query = genericName
      ? query.eq("generic_name", genericName)
      : query.is("generic_name", null);
    query = dispensingUnit
      ? query.eq("dispensing_unit", dispensingUnit)
      : query.is("dispensing_unit", null);
    query = brand ? query.eq("brand", brand) : query.is("brand", null);
    query = size ? query.eq("size", size) : query.is("size", null);
    query = colour ? query.eq("colour", colour) : query.is("colour", null);
  }

  const { data } = await query;
  const rows = (data ?? []) as unknown as { branch_id: string }[];
  return new Set(rows.map((row) => row.branch_id));
}

export async function getMedicines(
  search?: string,
  category?: string,
  categories?: string[],
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [] as Medicine[];
  const branchId = await getEffectiveBranchId(user);

  let query = supabase
    .from("medicines")
    .select("*")
    .order("name", { ascending: true });

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,generic_name.ilike.%${search}%,barcode.ilike.%${search}%`,
    );
  }

  // Filter to a specific category OR a set of mode-appropriate categories
  if (category) {
    query = query.eq("category", category);
  } else if (categories && categories.length > 0) {
    query = query.in("category", categories);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getMedicines error:", error);
    return [] as Medicine[];
  }

  return (data ?? []) as unknown as Medicine[];
}

export async function getMedicineById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as Medicine | null;
}

export async function createMedicine(formData: {
  name: string;
  generic_name?: string;
  category: string;
  dispensing_unit?: string;
  unit_price: number;
  cost_price: number;
  quantity_in_stock: number;
  reorder_level: number;
  expiry_date?: string;
  barcode?: string;
  requires_prescription: boolean;
  brand?: string;
  size?: string;
  colour?: string;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);
  if (!user) return { error: "Not authenticated" };
  if (!branchId) return { error: "No active branch selected" };
  if (!hasPermission(user.role, "add_medicine")) {
    return { error: "Insufficient permissions" };
  }

  const { error } = await supabase.from("medicines").insert({
    ...formData,
    branch_id: branchId,
    created_by: user.id,
  });

  if (error) {
    console.error("createMedicine error:", error);
    return { error: error.message };
  }

  // Admin quick-sync: create same item in all other branches with 0 stock
  // so staff only define an item once, then adjust quantities per branch.
  if (isAdminRole(user.role)) {
    const { data: branchData } = await supabase.from("branches").select("id");
    const otherBranchIds = ((branchData ?? []) as unknown as { id: string }[])
      .map((branch) => branch.id)
      .filter((id) => id !== branchId);

    if (otherBranchIds.length > 0) {
      const existingBranchIds = await findExistingBranchesForItem(
        supabase,
        otherBranchIds,
        formData,
      );

      const cloneRows = otherBranchIds
        .filter((id) => !existingBranchIds.has(id))
        .map((id) => ({
          ...formData,
          quantity_in_stock: 0,
          branch_id: id,
          created_by: user.id,
        }));

      if (cloneRows.length > 0) {
        const { error: cloneError } = await supabase
          .from("medicines")
          .insert(cloneRows as MedicineInsert[]);

        if (cloneError) {
          console.error("createMedicine branch clone error:", cloneError);
        }
      }
    }
  }

  // Log audit
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "create_medicine",
    details: {
      medicine_name: formData.name,
      propagated_to_all_branches: isAdminRole(user.role),
    },
  });

  // Send audit email for new medicine
  sendAuditEmail({
    action: "create_medicine",
    userName: user.full_name ?? "Staff",
    details: {
      medicine_name: formData.name,
      category: formData.category,
      quantity: formData.quantity_in_stock,
    },
  }).catch(() => {});

  revalidatePath("/inventory");
  return { success: true };
}

export async function updateMedicine(
  id: string,
  formData: {
    name?: string;
    generic_name?: string;
    category?: string;
    dispensing_unit?: string;
    unit_price?: number;
    cost_price?: number;
    quantity_in_stock?: number;
    reorder_level?: number;
    expiry_date?: string;
    barcode?: string;
    requires_prescription?: boolean;
    brand?: string;
    size?: string;
    colour?: string;
  },
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!hasPermission(user.role, "edit_medicine")) {
    return { error: "Insufficient permissions" };
  }

  const { error } = await supabase
    .from("medicines")
    .update(formData)
    .eq("id", id);

  if (error) {
    console.error("updateMedicine error:", error);
    return { error: error.message };
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "update_medicine",
    details: { medicine_id: id, updates: formData },
  });

  revalidatePath("/inventory");
  return { success: true };
}

export async function deleteMedicine(id: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "admin") {
    return { error: "Only admins can delete medicines" };
  }

  const { error } = await supabase.from("medicines").delete().eq("id", id);

  if (error) {
    console.error("deleteMedicine error:", error);
    return { error: error.message };
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "delete_medicine",
    details: { medicine_id: id },
  });

  sendAuditEmail({
    action: "delete_medicine",
    userName: user.full_name ?? "Admin",
    details: { medicine_id: id },
  }).catch(() => {});

  revalidatePath("/inventory");
  return { success: true };
}

export async function adjustStock(
  medicineId: string,
  adjustment: number,
  reason: string,
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (!hasPermission(user.role, "adjust_stock")) {
    return { error: "Insufficient permissions" };
  }

  // Get current stock
  const { data: medData, error: fetchError } = await supabase
    .from("medicines")
    .select("quantity_in_stock, name, reorder_level, category")
    .eq("id", medicineId)
    .single();

  const medicine = medData as {
    quantity_in_stock: number;
    name: string;
    reorder_level: number;
    category: string;
  } | null;
  if (fetchError || !medicine) return { error: "Medicine not found" };

  const newStock = medicine.quantity_in_stock + adjustment;
  if (newStock < 0) return { error: "Insufficient stock for this adjustment" };

  const { error } = await supabase
    .from("medicines")
    .update({ quantity_in_stock: newStock })
    .eq("id", medicineId);

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "stock_adjustment",
    details: {
      medicine_id: medicineId,
      medicine_name: medicine.name,
      previous_stock: medicine.quantity_in_stock,
      adjustment,
      new_stock: newStock,
      reason,
    },
  });

  sendAuditEmail({
    action: "stock_adjustment",
    userName: user.full_name ?? "Staff",
    details: {
      medicine_name: medicine.name,
      previous_stock: medicine.quantity_in_stock,
      adjustment,
      new_stock: newStock,
      reason,
    },
  }).catch(() => {});

  // Check if the adjusted medicine is now low stock
  if (newStock <= medicine.reorder_level) {
    sendLowStockEmail({
      items: [
        {
          name: medicine.name,
          category: medicine.category,
          quantity_in_stock: newStock,
          reorder_level: medicine.reorder_level,
        },
      ],
    }).catch(() => {});
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function bulkSetOpeningStock(
  rows: {
    barcode?: string;
    name?: string;
    quantity: number;
  }[],
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);

  if (!user) return { error: "Not authenticated" };
  if (!hasPermission(user.role, "bulk_opening_stock")) {
    return { error: "Only admins can bulk set opening stock" };
  }

  let resolvedBranchId = branchId;

  if (!resolvedBranchId && isAdminRole(user.role)) {
    const { data: branchesData, error: branchesError } = await supabase
      .from("branches")
      .select("id")
      .order("created_at", { ascending: true });

    if (branchesError) {
      return { error: branchesError.message };
    }

    const adminBranches = (
      (branchesData ?? []) as unknown as { id: string }[]
    ).map((branch) => branch.id);

    if (adminBranches.length === 1) {
      resolvedBranchId = adminBranches[0];
    }
  }

  if (!resolvedBranchId) {
    return {
      error:
        "No active branch selected. Choose a specific branch from the header and try again.",
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows provided" };
  }

  const { data: branchMedicinesData, error: medicinesError } = await supabase
    .from("medicines")
    .select("id, name, barcode, quantity_in_stock")
    .eq("branch_id", resolvedBranchId);

  if (medicinesError) {
    return { error: medicinesError.message };
  }

  type BranchMedicine = {
    id: string;
    name: string;
    barcode: string | null;
    quantity_in_stock: number;
  };

  const branchMedicines = (branchMedicinesData ??
    []) as unknown as BranchMedicine[];

  const byBarcode = new Map<string, BranchMedicine[]>();
  const byName = new Map<string, BranchMedicine[]>();

  for (const medicine of branchMedicines) {
    const nameKey = medicine.name.trim().toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), medicine]);

    const barcodeKey = medicine.barcode?.trim().toLowerCase();
    if (barcodeKey) {
      byBarcode.set(barcodeKey, [
        ...(byBarcode.get(barcodeKey) ?? []),
        medicine,
      ]);
    }
  }

  const errors: string[] = [];
  let updated = 0;
  let unchanged = 0;

  for (const row of rows) {
    const barcode = row.barcode?.trim();
    const name = row.name?.trim();
    const quantity = Number(row.quantity);

    const rowLabel = barcode || name || "(unknown item)";

    if (!Number.isFinite(quantity) || quantity < 0) {
      errors.push(`${rowLabel}: quantity must be 0 or greater`);
      continue;
    }

    let matches: BranchMedicine[] = [];

    if (barcode) {
      matches = byBarcode.get(barcode.toLowerCase()) ?? [];
    } else if (name) {
      matches = byName.get(name.toLowerCase()) ?? [];
    } else {
      errors.push("Row missing barcode/name");
      continue;
    }

    if (matches.length === 0) {
      errors.push(`${rowLabel}: not found in selected branch inventory`);
      continue;
    }

    if (matches.length > 1) {
      errors.push(
        `${rowLabel}: multiple matches found, use barcode to disambiguate`,
      );
      continue;
    }

    const medicine = matches[0];

    if (medicine.quantity_in_stock === quantity) {
      unchanged += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from("medicines")
      .update({ quantity_in_stock: quantity })
      .eq("id", medicine.id)
      .eq("branch_id", resolvedBranchId);

    if (updateError) {
      errors.push(`${rowLabel}: ${updateError.message}`);
      continue;
    }

    updated += 1;
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "bulk_set_opening_stock",
    details: {
      branch_id: resolvedBranchId,
      rows_received: rows.length,
      updated,
      unchanged,
      errors: errors.length,
      sample_errors: errors.slice(0, 20),
    },
  });

  sendAuditEmail({
    action: "bulk_set_opening_stock",
    userName: user.full_name ?? "Admin",
    details: {
      rows_received: rows.length,
      updated,
      unchanged,
      errors: errors.length,
    },
  }).catch(() => {});

  revalidatePath("/inventory");
  revalidatePath("/sales");

  return {
    success: true,
    updated,
    unchanged,
    failed: errors.length,
    errors: errors.slice(0, 30),
  };
}

export async function bulkCreateMedicines(
  rows: {
    name: string;
    generic_name?: string;
    category: string;
    unit_price: number;
    cost_price: number;
    quantity_in_stock: number;
    reorder_level: number;
    expiry_date?: string;
    barcode?: string;
    dispensing_unit?: string;
    requires_prescription: boolean;
  }[],
) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const branchId = await getEffectiveBranchId(user);
  if (!user) return { error: "Not authenticated" };
  if (!hasPermission(user.role, "import_medicines")) {
    return { error: "Insufficient permissions" };
  }

  let resolvedBranchId = branchId;
  if (!resolvedBranchId) {
    if (isAdminRole(user.role)) {
      const { data: branchesData, error: branchesError } = await supabase
        .from("branches")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(2);

      if (branchesError) {
        return { error: branchesError.message };
      }

      const branchIds = ((branchesData ?? []) as { id: string }[]).map(
        (branch) => branch.id,
      );

      if (branchIds.length === 1) {
        resolvedBranchId = branchIds[0];
      } else {
        return {
          error:
            "No active branch selected. Use the Branch selector and choose one branch (not All Branches).",
        };
      }
    } else {
      return { error: "No active branch selected" };
    }
  }

  const records = rows.map((row) => ({
    ...row,
    branch_id: resolvedBranchId,
    created_by: user.id,
  }));

  const { error } = await supabase
    .from("medicines")
    .insert(records as MedicineInsert[]);
  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "bulk_import_medicines",
    details: { count: rows.length },
  });

  revalidatePath("/inventory");
  return { success: true, count: rows.length };
}

export async function syncCatalogAcrossBranches() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user || !hasPermission(user.role, "sync_catalog")) {
    return { error: "Admin access required" };
  }

  const { data: branchesData, error: branchError } = await supabase
    .from("branches")
    .select("id");

  if (branchError) {
    return { error: branchError.message };
  }

  const branchIds = ((branchesData ?? []) as unknown as { id: string }[]).map(
    (branch) => branch.id,
  );

  if (branchIds.length <= 1) {
    return {
      success: true,
      created: 0,
      productsTracked: 0,
      message: "Nothing to sync. Only one branch exists.",
    };
  }

  type SeedRow = {
    id: string;
    name: string;
    generic_name: string | null;
    category: string;
    unit_price: number;
    cost_price: number;
    reorder_level: number;
    expiry_date: string | null;
    barcode: string | null;
    dispensing_unit: string | null;
    requires_prescription: boolean;
    brand: string | null;
    size: string | null;
    colour: string | null;
    branch_id: string;
    created_at: string;
  };

  const { data: allMedicinesData, error: medicinesError } = await supabase
    .from("medicines")
    .select(
      "id, name, generic_name, category, unit_price, cost_price, reorder_level, expiry_date, barcode, dispensing_unit, requires_prescription, brand, size, colour, branch_id, created_at",
    )
    .order("created_at", { ascending: true });

  if (medicinesError) {
    return { error: medicinesError.message };
  }

  const allMedicines = (allMedicinesData ?? []) as unknown as SeedRow[];

  if (allMedicines.length === 0) {
    return {
      success: true,
      created: 0,
      productsTracked: 0,
      message: "No products found to sync.",
    };
  }

  const canonicalByKey = new Map<string, SeedRow>();
  const branchesByKey = new Map<string, Set<string>>();

  for (const medicine of allMedicines) {
    const key = buildMedicineIdentityKey(medicine);
    if (!canonicalByKey.has(key)) {
      canonicalByKey.set(key, medicine);
    }
    if (!branchesByKey.has(key)) {
      branchesByKey.set(key, new Set<string>());
    }
    branchesByKey.get(key)!.add(medicine.branch_id);
  }

  const rowsToInsert: MedicineInsert[] = [];

  for (const [key, canonical] of canonicalByKey.entries()) {
    const existingBranches = branchesByKey.get(key) ?? new Set<string>();

    for (const branchId of branchIds) {
      if (existingBranches.has(branchId)) continue;

      rowsToInsert.push({
        name: canonical.name,
        generic_name: canonical.generic_name,
        category: canonical.category,
        unit_price: canonical.unit_price,
        cost_price: canonical.cost_price,
        quantity_in_stock: 0,
        reorder_level: canonical.reorder_level,
        expiry_date: canonical.expiry_date,
        barcode: canonical.barcode,
        dispensing_unit: canonical.dispensing_unit,
        requires_prescription: canonical.requires_prescription,
        brand: canonical.brand,
        size: canonical.size,
        colour: canonical.colour,
        branch_id: branchId,
        created_by: user.id,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    const chunkSize = 500;
    for (let index = 0; index < rowsToInsert.length; index += chunkSize) {
      const chunk = rowsToInsert.slice(index, index + chunkSize);
      const { error } = await supabase.from("medicines").insert(chunk);
      if (error) {
        return { error: error.message };
      }
    }
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "sync_catalog_all_branches",
    details: {
      products_tracked: canonicalByKey.size,
      rows_created: rowsToInsert.length,
      branch_count: branchIds.length,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/sales");
  revalidatePath("/transfers");

  return {
    success: true,
    created: rowsToInsert.length,
    productsTracked: canonicalByKey.size,
  };
}

export async function getCatalogSyncStatus() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user || !hasPermission(user.role, "sync_catalog")) {
    return { error: "Admin access required" };
  }

  const { data: branchesData, error: branchError } = await supabase
    .from("branches")
    .select("id");

  if (branchError) {
    return { error: branchError.message };
  }

  const branchIds = ((branchesData ?? []) as unknown as { id: string }[]).map(
    (branch) => branch.id,
  );

  if (branchIds.length === 0) {
    return {
      success: true,
      totalUniqueProducts: 0,
      branchCount: 0,
      expectedCopies: 0,
      actualCopies: 0,
      missingBranchCopies: 0,
      coveragePercent: 100,
      synced: true,
    };
  }

  type StatusRow = {
    name: string;
    generic_name: string | null;
    category: string;
    barcode: string | null;
    dispensing_unit: string | null;
    requires_prescription: boolean;
    brand: string | null;
    size: string | null;
    colour: string | null;
    branch_id: string;
  };

  const { data: medicinesData, error: medicinesError } = await supabase
    .from("medicines")
    .select(
      "name, generic_name, category, barcode, dispensing_unit, requires_prescription, brand, size, colour, branch_id",
    );

  if (medicinesError) {
    return { error: medicinesError.message };
  }

  const medicines = (medicinesData ?? []) as unknown as StatusRow[];

  if (medicines.length === 0) {
    return {
      success: true,
      totalUniqueProducts: 0,
      branchCount: branchIds.length,
      expectedCopies: 0,
      actualCopies: 0,
      missingBranchCopies: 0,
      coveragePercent: 100,
      synced: true,
    };
  }

  const branchesByKey = new Map<string, Set<string>>();

  for (const medicine of medicines) {
    const key = buildMedicineIdentityKey(medicine);
    if (!branchesByKey.has(key)) {
      branchesByKey.set(key, new Set<string>());
    }
    branchesByKey.get(key)!.add(medicine.branch_id);
  }

  const totalUniqueProducts = branchesByKey.size;
  const expectedCopies = totalUniqueProducts * branchIds.length;
  const actualCopies = medicines.length;
  const missingBranchCopies = Math.max(0, expectedCopies - actualCopies);
  const coveragePercent =
    expectedCopies === 0
      ? 100
      : Math.round((actualCopies / expectedCopies) * 10000) / 100;

  return {
    success: true,
    totalUniqueProducts,
    branchCount: branchIds.length,
    expectedCopies,
    actualCopies,
    missingBranchCopies,
    coveragePercent,
    synced: missingBranchCopies === 0,
  };
}
