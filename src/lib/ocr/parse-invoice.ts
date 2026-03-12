/**
 * Parse OCR text output from a supplier invoice into structured medicine rows.
 *
 * Invoice format (from BARAKA RUNYENJES CHEMIST and similar Kenyan distributors):
 *   DESCRIPTION | BATCH NO | QTY OUT | EXP. DATE | QTY | PW | PRICE | DISC | VAT | TOTAL
 *
 * We extract: name, batch (→ barcode), quantity, expiry date, cost price (PRICE column).
 */

export interface InvoiceMedicineRow {
  /** Medicine name as printed on invoice */
  name: string;
  /** Batch number → maps to barcode field */
  batchNo: string;
  /** Quantity purchased (QTY column or QTY OUT) */
  quantity: number;
  /** Expiry date string (DD/MM/YYYY format from invoice) */
  expiryDate: string;
  /** Cost price per unit (PRICE column on invoice) */
  costPrice: number;
  /** Total from invoice */
  total: number;
  /** Category — default "Other", user can change */
  category: string;
  /** Raw line text for debugging */
  _rawLine: string;
}

/**
 * Normalize common OCR misreads in date strings.
 * e.g. "31/0B/2028" → "31/08/2028"
 */
function fixOcrDate(raw: string): string {
  return raw
    .replace(/[oO]/g, "0")
    .replace(/[lI]/g, "1")
    .replace(/[sS](?=\d)/g, "5")
    .replace(/[B](?=\/|\d)/g, "8");
}

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD for database storage.
 */
function convertDateFormat(ddmmyyyy: string): string {
  const cleaned = fixOcrDate(ddmmyyyy.trim());
  const match = cleaned.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Try to parse a number from OCR text. Handles commas and common misreads.
 */
function parseNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[oO]/g, "0")
    .replace(/[lI]/g, "1")
    .replace(/[,]/g, "")
    .replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Main parser: takes OCR text and returns structured rows.
 */
export function parseInvoiceText(ocrText: string): InvoiceMedicineRow[] {
  const lines = ocrText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const results: InvoiceMedicineRow[] = [];

  // Find the header line to understand column positions
  // Look for lines containing key header words
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase();
    if (
      (upper.includes("DESCRIPTION") || upper.includes("ITEM")) &&
      (upper.includes("PRICE") ||
        upper.includes("TOTAL") ||
        upper.includes("QTY"))
    ) {
      headerIndex = i;
      break;
    }
  }

  // Data lines start after the header
  const startIdx = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Skip obviously non-data lines
    const upper = line.toUpperCase();
    if (
      upper.includes("CUSTOMER") ||
      upper.includes("ADDRESS") ||
      upper.includes("TOWN") ||
      upper.includes("TILL NO") ||
      upper.includes("INVOICE") ||
      upper.includes("PAGE") ||
      upper.includes("REFERENCE") ||
      (upper.includes("TOTAL") && !upper.match(/\d{2,}/)) ||
      line.length < 10
    ) {
      continue;
    }

    // Strategy: Look for date patterns (DD/MM/YYYY) and number patterns
    // The line typically follows: NAME ... BATCHNO ... QTYOUT ... EXPDATE ... QTY ... PRICE ... TOTAL

    // Find date pattern (expiry date)
    const dateMatch = line.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);

    if (!dateMatch) {
      // No date found — might be a continuation line or non-medicine row
      // Try to extract if it has enough numeric content
      continue;
    }

    const rawDate = dateMatch[0];
    const datePos = line.indexOf(rawDate);
    const beforeDate = line.substring(0, datePos).trim();
    const afterDate = line.substring(datePos + rawDate.length).trim();

    // Before the date: NAME ... BATCH ... QTY_OUT
    // After the date: QTY PW PRICE DISC VAT TOTAL

    // Extract numbers from after the date section
    const afterNumbers = afterDate.match(/[\d,.]+/g) ?? [];

    // Parse the after-date numbers
    // Typical pattern: QTY, possibly "W", PRICE, DISC, VAT, TOTAL
    // Filter out very small numbers that might be noise
    const numericValues = afterNumbers
      .map((n) => parseNumber(n))
      .filter((n) => n > 0);

    let qty = 0;
    let price = 0;
    let total = 0;

    if (numericValues.length >= 3) {
      // QTY ... PRICE ... TOTAL (with possible DISC/VAT=0 in between)
      qty = numericValues[0];
      // Price is usually the second significant number, total is last
      total = numericValues[numericValues.length - 1];
      price = numericValues[1];
    } else if (numericValues.length === 2) {
      price = numericValues[0];
      total = numericValues[1];
      qty = total > 0 && price > 0 ? Math.round(total / price) : 1;
    } else if (numericValues.length === 1) {
      total = numericValues[0];
      price = total;
      qty = 1;
    }

    // Parse the before-date section for name, batch, and qty_out
    // Split by multiple spaces or common separators
    const beforeParts = beforeDate.split(/\s{2,}|\t/).filter(Boolean);

    // Extract batch number (usually alphanumeric pattern near the date)
    // Also grab QTY OUT if present
    let nameRaw = "";
    let batchNo = "";
    let qtyOut = 0;

    if (beforeParts.length >= 3) {
      nameRaw = beforeParts[0];
      batchNo = beforeParts[1];
      qtyOut = parseNumber(beforeParts[2]);
    } else if (beforeParts.length === 2) {
      nameRaw = beforeParts[0];
      // Could be batch or qty
      if (/[a-zA-Z]/.test(beforeParts[1])) {
        batchNo = beforeParts[1];
      } else {
        qtyOut = parseNumber(beforeParts[1]);
      }
    } else if (beforeParts.length === 1) {
      // Try to split the single chunk more aggressively
      const tokens = beforeDate.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        // Last token might be a number (qty) or batch
        const lastToken = tokens[tokens.length - 1];
        const secondLast = tokens.length > 2 ? tokens[tokens.length - 2] : "";

        if (/^\d+$/.test(lastToken)) {
          qtyOut = parseNumber(lastToken);
          if (secondLast && /[a-zA-Z]/.test(secondLast)) {
            batchNo = secondLast;
            nameRaw = tokens.slice(0, -2).join(" ");
          } else {
            nameRaw = tokens.slice(0, -1).join(" ");
          }
        } else {
          batchNo = lastToken;
          nameRaw = tokens.slice(0, -1).join(" ");
        }
      } else {
        nameRaw = beforeDate;
      }
    }

    // Use QTY from after date if available, else from before
    const finalQty = qty > 0 ? qty : qtyOut > 0 ? qtyOut : 1;

    // Clean up the name
    const name = nameRaw
      .replace(/^\d+\.\s*/, "") // Remove leading numbers
      .replace(/\s+/g, " ")
      .trim();

    if (!name || name.length < 3) continue;

    results.push({
      name,
      batchNo: batchNo.trim(),
      quantity: finalQty,
      expiryDate: convertDateFormat(rawDate),
      costPrice: price,
      total,
      category: "Other",
      _rawLine: line,
    });
  }

  return results;
}
