import {
  getUnsyncedSales,
  markSaleSynced,
  getSyncQueue,
  removeFromSyncQueue,
} from "./db";
import { isActuallyOnline, invalidateConnectivityCache } from "./connectivity";
import { createClient } from "@/lib/supabase/client";

export async function syncOfflineData() {
  const online = await isActuallyOnline();
  if (!online) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  try {
    // Sync offline sales
    const unsyncedSales = await getUnsyncedSales();
    const supabase = createClient();

    for (const sale of unsyncedSales) {
      try {
        // Check if this sale was already partially synced (e.g. connection
        // dropped after insert but before markSaleSynced)
        const { data: existing } = await supabase
          .from("sales")
          .select("id")
          .eq("receipt_number", sale.id)
          .maybeSingle();

        if (existing) {
          // Sale already exists on server — just mark it synced locally
          await markSaleSynced(sale.id);
          synced++;
          continue;
        }

        // Insert sale
        const { data: saleRecord, error: saleError } = await supabase
          .from("sales")
          .insert({
            receipt_number: sale.id,
            total_amount: sale.total_amount,
            payment_method: sale.payment_method,
            branch_id: sale.branch_id,
            created_at: sale.created_at,
          })
          .select()
          .single();

        if (saleError) throw saleError;

        const record = saleRecord as unknown as { id: string };

        // Insert sale items
        const saleItems = sale.items.map(
          (item: {
            medicine_id: string;
            quantity: number;
            unit_price: number;
          }) => ({
            sale_id: record.id,
            medicine_id: item.medicine_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }),
        );

        const { error: itemsError } = await supabase
          .from("sale_items")
          .insert(saleItems);

        if (itemsError) throw itemsError;

        // Deduct stock for each item sold
        for (const item of sale.items) {
          const { data: med } = await supabase
            .from("medicines")
            .select("quantity_in_stock")
            .eq("id", item.medicine_id)
            .single();

          if (med) {
            const newStock = Math.max(
              0,
              (med as { quantity_in_stock: number }).quantity_in_stock -
                item.quantity,
            );
            await supabase
              .from("medicines")
              .update({ quantity_in_stock: newStock })
              .eq("id", item.medicine_id);
          }
        }

        await markSaleSynced(sale.id);
        synced++;
      } catch (err) {
        console.error("Failed to sync sale:", sale.id, err);
        failed++;
      }
    }

    // Process sync queue
    const queue = await getSyncQueue();
    for (const item of queue) {
      try {
        // Execute queued action
        switch (item.action) {
          case "stock_adjustment": {
            const { medicineId, adjustment } = item.payload;
            const { data: med } = await supabase
              .from("medicines")
              .select("quantity_in_stock")
              .eq("id", medicineId)
              .single();

            if (med) {
              await supabase
                .from("medicines")
                .update({
                  quantity_in_stock: med.quantity_in_stock + adjustment,
                })
                .eq("id", medicineId);
            }
            break;
          }
          default:
            console.warn("Unknown sync action:", item.action);
        }

        await removeFromSyncQueue(item.id!);
        synced++;
      } catch (err) {
        console.error("Failed to process queue item:", item.id, err);
        failed++;
      }
    }
  } catch (err) {
    console.error("Sync failed:", err);
  }

  return { synced, failed };
}

// Auto-sync when coming back online AND on a periodic timer
export function startAutoSync(
  onSync?: (result: { synced: number; failed: number }) => void,
) {
  let syncTimer: ReturnType<typeof setInterval> | null = null;

  const trySync = async () => {
    // Wait a moment for the connection to stabilise, then verify it's real
    await new Promise((r) => setTimeout(r, 1500));
    invalidateConnectivityCache();
    const online = await isActuallyOnline();
    if (!online) return;
    const result = await syncOfflineData();
    if (onSync && (result.synced > 0 || result.failed > 0)) onSync(result);
  };

  const handleOnline = () => trySync();

  window.addEventListener("online", handleOnline);

  // Also poll every 60 s — catches the case where internet comes back
  // without the browser firing the "online" event
  syncTimer = setInterval(trySync, 60_000);

  return () => {
    window.removeEventListener("online", handleOnline);
    if (syncTimer) clearInterval(syncTimer);
  };
}
