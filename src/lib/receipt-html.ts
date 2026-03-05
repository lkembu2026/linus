// =============================================
// LK PHARMACARE — PREMIUM RECEIPT HTML GENERATOR
// =============================================

export function generateReceiptHtml(data: {
  receiptNo: string;
  items: { name: string; quantity: number; unit_price: number }[];
  total: number;
  paymentMethod: string;
  paidAmount?: number;
  balanceDue?: number;
  cashierName: string;
  branchName: string;
  cashTendered?: number;
  change?: number;
  date: string;
}) {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;color:#e0e0e0;font-size:13px;">${item.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;text-align:center;color:#a0a0b0;font-size:13px;">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;text-align:right;color:#a0a0b0;font-size:13px;">KES ${item.unit_price.toLocaleString()}</td>
        <td style="padding:8px 0;border-bottom:1px solid #1a1a2e;text-align:right;color:#e0e0e0;font-weight:600;font-size:13px;">KES ${(item.unit_price * item.quantity).toLocaleString()}</td>
      </tr>`,
    )
    .join("");

  const cashSection =
    data.paymentMethod === "cash" && data.cashTendered
      ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:#a0a0b0;font-size:13px;">
        <span>Cash Tendered</span>
        <span style="color:#e0e0e0;">KES ${data.cashTendered.toLocaleString()}</span>
      </div>
      ${
        data.change && data.change > 0
          ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#4ade80;font-size:13px;font-weight:600;">
        <span>Change</span>
        <span>KES ${data.change.toLocaleString()}</span>
      </div>`
          : ""
      }`
      : "";

  const paidAmount = Number(data.paidAmount ?? data.total);
  const balanceDue = Number(data.balanceDue ?? 0);

  const paymentBreakdownSection =
    paidAmount !== data.total || balanceDue > 0
      ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:#a0a0b0;font-size:13px;">
        <span>Paid Now</span>
        <span style="color:#e0e0e0;">KES ${paidAmount.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:${balanceDue > 0 ? "#f59e0b" : "#4ade80"};font-size:13px;font-weight:600;">
        <span>Balance Due</span>
        <span>KES ${Math.max(0, balanceDue).toLocaleString()}</span>
      </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.receiptNo}</title>
  <style>
    @media print {
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <div style="max-width:360px;margin:0 auto;padding:24px 20px;background:#0a0a0f;">
    
    <!-- Header with gradient accent -->
    <div style="text-align:center;padding-bottom:20px;">
      <div style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#00ffe0 0%,#00b8a9 100%);border-radius:8px;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:800;color:#0a0a0f;letter-spacing:1px;">LK PHARMACARE</div>
      </div>
      <div style="color:#a0a0b0;font-size:12px;margin-top:8px;">${data.branchName}</div>
      <div style="color:#666;font-size:11px;margin-top:4px;">${data.date}</div>
    </div>

    <!-- Receipt number badge -->
    <div style="text-align:center;margin:16px 0;">
      <div style="display:inline-block;padding:6px 16px;border:1px solid #00ffe0;border-radius:20px;color:#00ffe0;font-size:12px;font-weight:600;letter-spacing:0.5px;">
        ${data.receiptNo}
      </div>
    </div>

    <!-- Decorative line -->
    <div style="height:1px;background:linear-gradient(to right,transparent,#1a1a2e 20%,#00ffe0 50%,#1a1a2e 80%,transparent);margin:16px 0;"></div>

    <!-- Items table -->
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <thead>
        <tr>
          <th style="padding:8px 0;text-align:left;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Item</th>
          <th style="padding:8px 0;text-align:center;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Qty</th>
          <th style="padding:8px 0;text-align:right;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Price</th>
          <th style="padding:8px 0;text-align:right;color:#00ffe0;font-size:10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1a1a2e;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Decorative line -->
    <div style="height:2px;background:linear-gradient(to right,transparent,#00ffe0,transparent);margin:16px 0;"></div>

    <!-- Total -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:linear-gradient(135deg,#0d1117 0%,#111827 100%);border:1px solid #00ffe0;border-radius:10px;margin:8px 0;">
      <span style="color:#00ffe0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Total</span>
      <span style="color:#00ffe0;font-size:22px;font-weight:800;">KES ${data.total.toLocaleString()}</span>
    </div>

    <!-- Payment info -->
    <div style="margin:16px 0;padding:12px 16px;background:#111827;border-radius:8px;border:1px solid #1a1a2e;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="color:#a0a0b0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Payment</span>
        <span style="display:inline-block;padding:2px 12px;background:${data.paymentMethod === "mpesa" ? "#065F46" : "#1e3a5f"};color:${data.paymentMethod === "mpesa" ? "#6ee7b7" : "#93c5fd"};border-radius:12px;font-size:11px;font-weight:600;">${data.paymentMethod.toUpperCase()}</span>
      </div>
      ${cashSection}
      ${paymentBreakdownSection}
    </div>

    <!-- Decorative line -->
    <div style="height:1px;background:linear-gradient(to right,transparent,#1a1a2e 20%,#1a1a2e 80%,transparent);margin:16px 0;"></div>

    <!-- Footer -->
    <div style="text-align:center;padding:12px 0;">
      <div style="color:#a0a0b0;font-size:11px;">Served by <span style="color:#e0e0e0;font-weight:600;">${data.cashierName}</span></div>
      <div style="margin:16px 0;">
        <div style="color:#00ffe0;font-size:13px;font-weight:600;">Thank you for your purchase!</div>
        <div style="color:#555;font-size:10px;margin-top:4px;">Get well soon \u2014 we care about your health</div>
      </div>
      <div style="height:1px;background:#1a1a2e;margin:12px 0;"></div>
      <div style="color:#333;font-size:9px;letter-spacing:0.5px;">&copy; ${new Date().getFullYear()} LK PharmaCare &bull; All rights reserved</div>
    </div>
  </div>
</body>
</html>`;
}
