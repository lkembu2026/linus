// =============================================
// LK PHARMACARE — EMAIL SERVICE (Resend)
// =============================================

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@lkpharmacare.com";
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ??
  process.env.FROM_EMAIL ??
  "LK PharmaCare <onboarding@resend.dev>";

// ---- Helpers ----

function getFallbackReportRecipients(): string[] {
  const configured = process.env.REPORT_EMAILS ?? process.env.ADMIN_EMAIL ?? "";
  const recipients = configured
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  return recipients.length > 0 ? recipients : [ADMIN_EMAIL];
}

async function getReportRecipients(): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("report_settings")
      .select("recipients")
      .eq("key", "default")
      .maybeSingle();

    if (error) {
      console.warn(
        "[Email] Failed to load report settings. Using fallback recipients.",
        error.message,
      );
      return getFallbackReportRecipients();
    }

    const recipients = (data?.recipients ?? [])
      .map((email) => email.trim())
      .filter(Boolean);

    return recipients.length > 0 ? recipients : getFallbackReportRecipients();
  } catch (error) {
    console.warn(
      "[Email] Report settings unavailable. Using fallback recipients.",
      error,
    );
    return getFallbackReportRecipients();
  }
}

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

function wrapHtml(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#0D0D0D; color:#E5E7EB; font-family:'Segoe UI',Arial,sans-serif; }
    .container { max-width:600px; margin:0 auto; padding:32px 24px; }
    .header { text-align:center; padding-bottom:24px; border-bottom:1px solid #1F2937; margin-bottom:24px; }
    .header h1 { color:#00FFE0; font-size:20px; margin:0 0 4px; }
    .header p { color:#9CA3AF; font-size:12px; margin:0; }
    .card { background:#111827; border:1px solid #1F2937; border-radius:12px; padding:20px; margin-bottom:16px; }
    .card h2 { color:#00FFE0; font-size:16px; margin:0 0 12px; }
    .label { color:#9CA3AF; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; }
    .value { color:#F9FAFB; font-size:14px; font-weight:600; }
    .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #1F2937; }
    .row:last-child { border-bottom:none; }
    .total-row { display:flex; justify-content:space-between; padding:10px 0; font-size:16px; font-weight:700; color:#00FFE0; }
    .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
    .badge-info { background:#0E7490; color:#CFFAFE; }
    .badge-warning { background:#92400E; color:#FEF3C7; }
    .badge-success { background:#065F46; color:#D1FAE5; }
    .badge-error { background:#991B1B; color:#FEE2E2; }
    .footer { text-align:center; padding-top:24px; border-top:1px solid #1F2937; margin-top:24px; }
    .footer p { color:#6B7280; font-size:11px; margin:4px 0; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; color:#9CA3AF; font-size:11px; text-transform:uppercase; padding:8px 4px; border-bottom:1px solid #1F2937; }
    td { padding:8px 4px; font-size:13px; color:#E5E7EB; border-bottom:1px solid #111827; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LK PharmaCare</h1>
      <p>Multi-Branch Pharmacy Operating System</p>
    </div>
    ${body}
    <div class="footer">
      <p>This is an automated email from LK PharmaCare</p>
      <p>&copy; ${new Date().getFullYear()} LK PharmaCare. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ---- Email Senders ----

/**
 * Send a sale receipt email to the admin
 */
export async function sendReceiptEmail(data: {
  receiptNo: string;
  items: { name: string; quantity: number; unit_price: number }[];
  total: number;
  paymentMethod: string;
  cashierName: string;
  branchName: string;
  paidAmount?: number;
  balanceDue?: number;
  cashTendered?: number;
  change?: number;
  mpesaCode?: string;
  saleDate?: string;
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(
        "[Email] RESEND_API_KEY is not configured. Skipping receipt email.",
      );
      return;
    }

    const itemRows = data.items
      .map(
        (item) =>
          `<tr>
            <td>${item.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${formatKES(item.unit_price)}</td>
            <td style="text-align:right">${formatKES(item.unit_price * item.quantity)}</td>
          </tr>`,
      )
      .join("");

    const paymentDetails =
      data.paymentMethod === "cash" && data.cashTendered
        ? `
          <div class="row"><span class="label">Cash Tendered</span><span class="value">${formatKES(data.cashTendered)}</span></div>
          <div class="row"><span class="label">Change</span><span class="value">${formatKES(data.change ?? 0)}</span></div>`
        : "";

    const paidAmount = Number(data.paidAmount ?? data.total);
    const balanceDue = Number(
      data.balanceDue ?? Math.max(data.total - paidAmount, 0),
    );
    const balanceDetails =
      balanceDue > 0
        ? `
          <div class="row"><span class="label">Paid Now</span><span class="value">${formatKES(paidAmount)}</span></div>
          <div class="row"><span class="label">Credit Balance</span><span class="value">${formatKES(balanceDue)}</span></div>`
        : `
          <div class="row"><span class="label">Paid</span><span class="value">${formatKES(paidAmount)}</span></div>`;
    const mpesaDetails =
      data.paymentMethod === "mpesa" && data.mpesaCode
        ? `
          <div class="row"><span class="label">M-Pesa Code</span><span class="value">${data.mpesaCode}</span></div>`
        : "";

    const body = `
      <div class="card">
        <h2>🧾 Sale Receipt — ${data.receiptNo}</h2>
        <div class="row"><span class="label">Branch</span><span class="value">${data.branchName}</span></div>
        <div class="row"><span class="label">Cashier</span><span class="value">${data.cashierName}</span></div>
        <div class="row"><span class="label">Payment</span><span class="value badge badge-info">${data.paymentMethod.toUpperCase()}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${data.saleDate ?? new Date().toLocaleString("en-KE")}</span></div>
        ${mpesaDetails}
      </div>
      <div class="card">
        <h2>Items</h2>
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Subtotal</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="margin-top:12px; border-top:2px solid #00FFE0; padding-top:12px;">
          <div class="total-row"><span>TOTAL</span><span>${formatKES(data.total)}</span></div>
          ${balanceDetails}
          ${paymentDetails}
        </div>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🧾 Sale ${data.receiptNo} — ${formatKES(data.total)} via ${data.paymentMethod.toUpperCase()}`,
      html: wrapHtml(`Sale Receipt ${data.receiptNo}`, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send receipt email:", err);
  }
}

/**
 * Send a notification email to the admin
 */
export async function sendNotificationEmail(data: {
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
}) {
  try {
    const badgeClass = `badge-${data.type}`;
    const icons: Record<string, string> = {
      info: "ℹ️",
      warning: "⚠️",
      success: "✅",
      error: "❌",
    };

    const body = `
      <div class="card">
        <h2>${icons[data.type] ?? "📢"} ${data.title}</h2>
        <p style="color:#D1D5DB; font-size:14px; line-height:1.6; margin:12px 0 0;">${data.message}</p>
        <div style="margin-top:16px;">
          <span class="badge ${badgeClass}">${data.type.toUpperCase()}</span>
          <span style="color:#6B7280; font-size:11px; margin-left:8px;">${new Date().toLocaleString("en-KE")}</span>
        </div>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `${icons[data.type] ?? "📢"} [${data.type.toUpperCase()}] ${data.title}`,
      html: wrapHtml(data.title, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send notification email:", err);
  }
}

/**
 * Send a transfer request email to the admin
 */
export async function sendTransferEmail(data: {
  medicineName: string;
  quantity: number;
  fromBranch: string;
  toBranch: string;
  requestedBy: string;
  status: "pending" | "approved" | "rejected";
}) {
  try {
    const statusColors: Record<string, string> = {
      pending: "badge-warning",
      approved: "badge-success",
      rejected: "badge-error",
    };
    const statusIcons: Record<string, string> = {
      pending: "🔄",
      approved: "✅",
      rejected: "❌",
    };

    const body = `
      <div class="card">
        <h2>${statusIcons[data.status]} Stock Transfer — ${data.status.toUpperCase()}</h2>
        <div class="row"><span class="label">Medicine</span><span class="value">${data.medicineName}</span></div>
        <div class="row"><span class="label">Quantity</span><span class="value">${data.quantity} units</span></div>
        <div class="row"><span class="label">From Branch</span><span class="value">${data.fromBranch}</span></div>
        <div class="row"><span class="label">To Branch</span><span class="value">${data.toBranch}</span></div>
        <div class="row"><span class="label">Requested By</span><span class="value">${data.requestedBy}</span></div>
        <div class="row"><span class="label">Status</span><span class="value badge ${statusColors[data.status]}">${data.status.toUpperCase()}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${new Date().toLocaleString("en-KE")}</span></div>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `${statusIcons[data.status]} Transfer ${data.status}: ${data.medicineName} (${data.quantity} units)`,
      html: wrapHtml(`Stock Transfer — ${data.medicineName}`, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send transfer email:", err);
  }
}

/**
 * Send a low stock alert email to the admin
 */
export async function sendLowStockEmail(data: {
  items: {
    name: string;
    category: string;
    quantity_in_stock: number;
    reorder_level: number;
    branch_name?: string;
  }[];
}) {
  if (data.items.length === 0) return;

  try {
    const rows = data.items
      .map(
        (item) =>
          `<tr>
            <td>${item.name}</td>
            <td>${item.category}</td>
            <td style="text-align:center; color:${item.quantity_in_stock === 0 ? "#EF4444" : "#FBBF24"}; font-weight:700;">${item.quantity_in_stock}</td>
            <td style="text-align:center">${item.reorder_level}</td>
            ${item.branch_name ? `<td>${item.branch_name}</td>` : ""}
          </tr>`,
      )
      .join("");

    const hasBranch = data.items.some((i) => i.branch_name);
    const outOfStock = data.items.filter(
      (i) => i.quantity_in_stock === 0,
    ).length;

    const body = `
      <div class="card">
        <h2>⚠️ Low Stock Alert — ${data.items.length} Item${data.items.length > 1 ? "s" : ""}</h2>
        <p style="color:#D1D5DB; font-size:14px; margin:4px 0 16px;">
          ${outOfStock > 0 ? `<span style="color:#EF4444; font-weight:700;">${outOfStock} out of stock!</span> ` : ""}
          ${data.items.length} medicine${data.items.length > 1 ? "s" : ""} below reorder level.
        </p>
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th style="text-align:center">Stock</th>
              <th style="text-align:center">Min Level</th>
              ${hasBranch ? "<th>Branch</th>" : ""}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `⚠️ Low Stock Alert: ${data.items.length} item${data.items.length > 1 ? "s" : ""} need restocking${outOfStock > 0 ? ` (${outOfStock} out of stock)` : ""}`,
      html: wrapHtml("Low Stock Alert", body),
    });
  } catch (err) {
    console.error("[Email] Failed to send low stock email:", err);
  }
}

/**
 * Send an audit event email to the admin (for critical actions)
 */
export async function sendAuditEmail(data: {
  action: string;
  userName: string;
  details: Record<string, unknown>;
}) {
  try {
    const actionLabels: Record<string, string> = {
      create_sale: "🛒 New Sale Created",
      void_sale: "🚫 Sale Voided",
      create_transfer: "📦 Transfer Requested",
      approve_transfer: "✅ Transfer Approved",
      reject_transfer: "❌ Transfer Rejected",
      register_user: "👤 New User Registered",
      delete_medicine: "🗑️ Medicine Deleted",
      stock_adjustment: "📊 Stock Adjusted",
      create_medicine: "💊 New Medicine Added",
    };

    const label = actionLabels[data.action] ?? `📋 ${data.action}`;

    const detailRows = Object.entries(data.details)
      .map(
        ([key, val]) =>
          `<div class="row"><span class="label">${key.replace(/_/g, " ")}</span><span class="value">${String(val)}</span></div>`,
      )
      .join("");

    const body = `
      <div class="card">
        <h2>${label}</h2>
        <div class="row"><span class="label">Performed By</span><span class="value">${data.userName}</span></div>
        <div class="row"><span class="label">Timestamp</span><span class="value">${new Date().toLocaleString("en-KE")}</span></div>
        ${detailRows}
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `${label} — by ${data.userName}`,
      html: wrapHtml(`Audit: ${data.action}`, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send audit email:", err);
  }
}

/**
 * Send a password reset notification to admin
 */
export async function sendPasswordResetNotifyEmail(email: string) {
  try {
    const body = `
      <div class="card">
        <h2>🔑 Password Reset Requested</h2>
        <p style="color:#D1D5DB; font-size:14px; line-height:1.6; margin:12px 0;">
          A password reset was requested for the account: <strong style="color:#00FFE0;">${email}</strong>
        </p>
        <div style="margin-top:16px;">
          <span class="badge badge-warning">SECURITY</span>
          <span style="color:#6B7280; font-size:11px; margin-left:8px;">${new Date().toLocaleString("en-KE")}</span>
        </div>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🔑 Password Reset Requested — ${email}`,
      html: wrapHtml("Password Reset", body),
    });
  } catch (err) {
    console.error("[Email] Failed to send password reset notify email:", err);
  }
}

/**
 * Send a credit sale notification to the admin
 */
export async function sendCreditEmail(data: {
  receiptNo: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  medicines: string;
  cashierName: string;
  branchName: string;
  notes?: string;
}) {
  try {
    const body = `
      <div class="card">
        <h2>💳 Credit Sale Recorded — ${data.receiptNo}</h2>
        <p style="color:#FBBF24; font-size:13px; margin:0 0 16px;">A sale was made on credit. Payment is pending from the customer.</p>
        <div class="row"><span class="label">Receipt #</span><span class="value">${data.receiptNo}</span></div>
        <div class="row"><span class="label">Branch</span><span class="value">${data.branchName}</span></div>
        <div class="row"><span class="label">Cashier</span><span class="value">${data.cashierName}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${new Date().toLocaleString("en-KE")}</span></div>
      </div>
      <div class="card">
        <h2>👤 Customer Details</h2>
        <div class="row"><span class="label">Name</span><span class="value">${data.customerName}</span></div>
        <div class="row"><span class="label">Phone</span><span class="value">${data.customerPhone ?? "Not provided"}</span></div>
        <div class="row"><span class="label">Medicines</span><span class="value">${data.medicines}</span></div>
        ${data.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${data.notes}</span></div>` : ""}
        <div style="margin-top:16px; padding:12px 16px; background:#111827; border:1px solid #92400E; border-radius:8px;">
          <div class="total-row"><span>Amount Owed</span><span>${formatKES(data.amount)}</span></div>
        </div>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `💳 Credit Sale: ${data.customerName} owes ${formatKES(data.amount)} — ${data.receiptNo}`,
      html: wrapHtml(`Credit Sale — ${data.receiptNo}`, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send credit email:", err);
  }
}

/**
 * Send a credit settled notification to the admin
 */
export async function sendCreditSettledEmail(data: {
  customerName: string;
  customerPhone?: string;
  amountSettled: number;
  totalAmount: number;
  settledBy: string;
  branchName: string;
}) {
  try {
    const isFullySettled = data.amountSettled >= data.totalAmount;
    const body = `
      <div class="card">
        <h2>${isFullySettled ? "✅ Credit Fully Settled" : "⚡ Partial Credit Payment"}</h2>
        <div class="row"><span class="label">Customer</span><span class="value">${data.customerName}</span></div>
        <div class="row"><span class="label">Phone</span><span class="value">${data.customerPhone ?? "N/A"}</span></div>
        <div class="row"><span class="label">Branch</span><span class="value">${data.branchName}</span></div>
        <div class="row"><span class="label">Settled By</span><span class="value">${data.settledBy}</span></div>
        <div class="row"><span class="label">Amount Paid</span><span class="value" style="color:#10B981;">${formatKES(data.amountSettled)}</span></div>
        <div class="row"><span class="label">Total Credit</span><span class="value">${formatKES(data.totalAmount)}</span></div>
        <div class="row"><span class="label">Outstanding</span><span class="value" style="color:${isFullySettled ? "#10B981" : "#FBBF24"};">${formatKES(Math.max(0, data.totalAmount - data.amountSettled))}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${new Date().toLocaleString("en-KE")}</span></div>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `${isFullySettled ? "✅ Credit Cleared" : "⚡ Partial Payment"}: ${data.customerName} paid ${formatKES(data.amountSettled)}`,
      html: wrapHtml(
        `Credit ${isFullySettled ? "Settled" : "Partial Payment"} — ${data.customerName}`,
        body,
      ),
    });
  } catch (err) {
    console.error("[Email] Failed to send credit settled email:", err);
  }
}

/**
 * Send a generated report email to the admin
 */
export async function sendReportEmail(data: {
  title: string;
  period: string;
  reportType: string;
  summary: Record<string, unknown>;
  generatedBy: string;
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(
        "[Email] RESEND_API_KEY is not configured. Skipping report email.",
      );
      return;
    }

    const summaryRows = Object.entries(data.summary)
      .map(
        ([k, v]) =>
          `<div class="row"><span class="label">${k.replace(/_/g, " ")}</span><span class="value">${String(v)}</span></div>`,
      )
      .join("");

    const typeLabel: Record<string, string> = {
      daily: "📅 Daily Report",
      monthly: "📊 Monthly Report",
      top_selling: "🏆 Top Selling Report",
      branches: "🏢 Branch Comparison Report",
    };

    const body = `
      <div class="card">
        <h2>${typeLabel[data.reportType] ?? "📋 Report"} Generated</h2>
        <div class="row"><span class="label">Period</span><span class="value">${data.period}</span></div>
        <div class="row"><span class="label">Generated By</span><span class="value">${data.generatedBy}</span></div>
        <div class="row"><span class="label">Date</span><span class="value">${new Date().toLocaleString("en-KE")}</span></div>
      </div>
      <div class="card">
        <h2>Summary</h2>
        ${summaryRows}
      </div>
      <div style="text-align:center; padding:16px 0;">
        <p style="color:#9CA3AF; font-size:12px;">Log in to LK PharmaCare to view the full report and download as PDF.</p>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: await getReportRecipients(),
      subject: `${typeLabel[data.reportType] ?? "📋 Report"}: ${data.title} — ${data.period}`,
      html: wrapHtml(data.title, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send report email:", err);
  }
}

/**
 * Send a daily summary email to the admin
 */
export async function sendDailySummaryEmail(data: {
  date: string;
  totalSales: number;
  totalRevenue: number;
  lowStockCount: number;
  transfersPending: number;
  topItems: { name: string; quantity: number; revenue: number }[];
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(
        "[Email] RESEND_API_KEY is not configured. Skipping daily summary email.",
      );
      return;
    }

    const topRows = data.topItems
      .slice(0, 5)
      .map(
        (item, i) =>
          `<tr>
            <td style="color:#00FFE0; font-weight:700;">#${i + 1}</td>
            <td>${item.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${formatKES(item.revenue)}</td>
          </tr>`,
      )
      .join("");

    const body = `
      <div class="card">
        <h2>📊 Daily Summary — ${data.date}</h2>
        <div class="row"><span class="label">Total Sales</span><span class="value">${data.totalSales} transactions</span></div>
        <div class="row"><span class="label">Total Revenue</span><span class="value" style="color:#00FFE0;">${formatKES(data.totalRevenue)}</span></div>
        <div class="row"><span class="label">Low Stock Items</span><span class="value" style="color:${data.lowStockCount > 0 ? "#FBBF24" : "#10B981"};">${data.lowStockCount}</span></div>
        <div class="row"><span class="label">Pending Transfers</span><span class="value">${data.transfersPending}</span></div>
      </div>
      ${
        data.topItems.length > 0
          ? `<div class="card">
              <h2>🏆 Top Selling Items</h2>
              <table>
                <thead><tr><th>#</th><th>Medicine</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>${topRows}</tbody>
              </table>
            </div>`
          : ""
      }`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: await getReportRecipients(),
      subject: `📊 Daily Summary: ${formatKES(data.totalRevenue)} revenue, ${data.totalSales} sales — ${data.date}`,
      html: wrapHtml(`Daily Summary — ${data.date}`, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send daily summary email:", err);
  }
}

/**
 * Send a weekly summary email to the admin (auto-generated every Sunday night)
 */
export async function sendWeeklySummaryEmail(data: {
  weekStart: string;
  weekEnd: string;
  totalSales: number;
  totalRevenue: number;
  totalVoided: number;
  avgDailyRevenue: number;
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
  branchBreakdown: { name: string; revenue: number; salesCount: number }[];
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(
        "[Email] RESEND_API_KEY is not configured. Skipping weekly summary email.",
      );
      return;
    }

    const topRows = data.topItems
      .slice(0, 10)
      .map(
        (item, i) =>
          `<tr>
            <td style="color:#00FFE0; font-weight:700;">#${i + 1}</td>
            <td>${item.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${formatKES(item.revenue)}</td>
          </tr>`,
      )
      .join("");

    const branchRows = data.branchBreakdown
      .map(
        (b) =>
          `<tr>
            <td>${b.name}</td>
            <td style="text-align:center">${b.salesCount}</td>
            <td style="text-align:right">${formatKES(b.revenue)}</td>
          </tr>`,
      )
      .join("");

    const paymentRows = Object.entries(data.paymentBreakdown)
      .map(
        ([method, amount]) =>
          `<div class="row"><span class="label">${method.toUpperCase()}</span><span class="value">${formatKES(amount)}</span></div>`,
      )
      .join("");

    const body = `
      <div class="card">
        <h2>📅 Weekly Sales Summary</h2>
        <div class="row"><span class="label">Period</span><span class="value">${data.weekStart} → ${data.weekEnd}</span></div>
        <div class="row"><span class="label">Total Transactions</span><span class="value">${data.totalSales}</span></div>
        <div class="row"><span class="label">Total Revenue</span><span class="value" style="color:#00FFE0; font-size:18px;">${formatKES(data.totalRevenue)}</span></div>
        <div class="row"><span class="label">Avg Daily Revenue</span><span class="value">${formatKES(data.avgDailyRevenue)}</span></div>
        <div class="row"><span class="label">Voided Sales</span><span class="value" style="color:#FBBF24;">${data.totalVoided}</span></div>
      </div>
      <div class="card">
        <h2>💳 Payment Breakdown</h2>
        ${paymentRows}
      </div>
      ${
        data.branchBreakdown.length > 1
          ? `<div class="card">
              <h2>🏢 Branch Performance</h2>
              <table>
                <thead><tr><th>Branch</th><th style="text-align:center">Sales</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>${branchRows}</tbody>
              </table>
            </div>`
          : ""
      }
      ${
        data.topItems.length > 0
          ? `<div class="card">
              <h2>🏆 Top Selling Items</h2>
              <table>
                <thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>${topRows}</tbody>
              </table>
            </div>`
          : ""
      }`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: await getReportRecipients(),
      subject: `📅 Weekly Summary (${data.weekStart} – ${data.weekEnd}): ${formatKES(data.totalRevenue)} | ${data.totalSales} sales`,
      html: wrapHtml(
        `Weekly Summary — ${data.weekStart} to ${data.weekEnd}`,
        body,
      ),
    });
  } catch (err) {
    console.error("[Email] Failed to send weekly summary email:", err);
  }
}

/**
 * Send a monthly summary email to the admin (auto-generated on the 1st of each month)
 */
export async function sendMonthlySummaryEmail(data: {
  monthLabel: string; // e.g. "January 2026"
  totalSales: number;
  totalRevenue: number;
  totalVoided: number;
  avgDailyRevenue: number;
  bestDay: { date: string; revenue: number };
  paymentBreakdown: Record<string, number>;
  topItems: { name: string; quantity: number; revenue: number }[];
  branchBreakdown: { name: string; revenue: number; salesCount: number }[];
}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(
        "[Email] RESEND_API_KEY is not configured. Skipping monthly summary email.",
      );
      return;
    }

    const topRows = data.topItems
      .slice(0, 10)
      .map(
        (item, i) =>
          `<tr>
            <td style="color:#00FFE0; font-weight:700;">#${i + 1}</td>
            <td>${item.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${formatKES(item.revenue)}</td>
          </tr>`,
      )
      .join("");

    const branchRows = data.branchBreakdown
      .map(
        (b) =>
          `<tr>
            <td>${b.name}</td>
            <td style="text-align:center">${b.salesCount}</td>
            <td style="text-align:right">${formatKES(b.revenue)}</td>
          </tr>`,
      )
      .join("");

    const paymentRows = Object.entries(data.paymentBreakdown)
      .map(
        ([method, amount]) =>
          `<div class="row"><span class="label">${method.toUpperCase()}</span><span class="value">${formatKES(amount)}</span></div>`,
      )
      .join("");

    const body = `
      <div class="card">
        <h2>📊 Monthly Sales Report — ${data.monthLabel}</h2>
        <div class="row"><span class="label">Total Transactions</span><span class="value">${data.totalSales}</span></div>
        <div class="row"><span class="label">Total Revenue</span><span class="value" style="color:#00FFE0; font-size:20px;">${formatKES(data.totalRevenue)}</span></div>
        <div class="row"><span class="label">Avg Daily Revenue</span><span class="value">${formatKES(data.avgDailyRevenue)}</span></div>
        <div class="row"><span class="label">Best Day</span><span class="value">${data.bestDay.date} — ${formatKES(data.bestDay.revenue)}</span></div>
        <div class="row"><span class="label">Voided Sales</span><span class="value" style="color:#FBBF24;">${data.totalVoided}</span></div>
      </div>
      <div class="card">
        <h2>💳 Payment Breakdown</h2>
        ${paymentRows}
      </div>
      ${
        data.branchBreakdown.length > 1
          ? `<div class="card">
              <h2>🏢 Branch Performance</h2>
              <table>
                <thead><tr><th>Branch</th><th style="text-align:center">Sales</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>${branchRows}</tbody>
              </table>
            </div>`
          : ""
      }
      ${
        data.topItems.length > 0
          ? `<div class="card">
              <h2>🏆 Top Selling Items — ${data.monthLabel}</h2>
              <table>
                <thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th></tr></thead>
                <tbody>${topRows}</tbody>
              </table>
            </div>`
          : ""
      }
      <div style="text-align:center; padding:16px 0;">
        <p style="color:#9CA3AF; font-size:12px;">Log in to LK PharmaCare to download this report as PDF.</p>
      </div>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: await getReportRecipients(),
      subject: `📊 Monthly Report — ${data.monthLabel}: ${formatKES(data.totalRevenue)} | ${data.totalSales} sales`,
      html: wrapHtml(`Monthly Report — ${data.monthLabel}`, body),
    });
  } catch (err) {
    console.error("[Email] Failed to send monthly summary email:", err);
  }
}
