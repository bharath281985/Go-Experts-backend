import { prisma } from "../../config/database.js";
import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "../../config/uploads.js";
import { chromium } from "playwright";

export async function generateInvoicePdf(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { user: true, items: true, subscription: { include: { plan: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");

  const invoicesDir = path.join(UPLOADS_DIR, "invoices");
  if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

  const filename = `invoice-${invoice.invoiceNumber || invoice.id}.pdf`;
  const filePath = path.join(invoicesDir, filename);
  const publicPath = `/uploads/invoices/${filename}`;

  // If already generated, return path
  if (invoice.pdfPath && fs.existsSync(path.join(UPLOADS_DIR, invoice.pdfPath.replace(/^[\/]+/, "")))) {
    return { filePath, publicPath };
  }

  const user = invoice.user || { fullName: "Customer", email: "" };
  const itemsHtml = (invoice.items || []).map((it: any) => `<tr><td>${it.description}</td><td style="text-align:right">${Number(it.amount).toFixed(2)}</td></tr>`).join("");

  // Try to load a CMS template named "Invoice Template" (cms_pages.name)
  let templateHtml: string | null = null;
  try {
    const cms = await prisma.cmsPage.findFirst({ where: { name: "Invoice Template" } });
    if (cms && cms.content) templateHtml = cms.content as string;
  } catch (err) {
    // ignore
  }

  let html = ``;
  if (templateHtml) {
    // Replace common placeholders
    html = templateHtml
      .replace(/\{\{\s*invoiceNumber\s*\}\}/gi, invoice.invoiceNumber || "")
      .replace(/\{\{\s*invoiceDate\s*\}\}/gi, new Date(invoice.createdAt).toLocaleDateString())
      .replace(/\{\{\s*userName\s*\}\}/gi, user.fullName || "")
      .replace(/\{\{\s*userEmail\s*\}\}/gi, user.email || "")
      .replace(/\{\{\s*subtotal\s*\}\}/gi, Number(invoice.subtotal).toFixed(2))
      .replace(/\{\{\s*gst\s*\}\}/gi, Number(invoice.gst).toFixed(2))
      .replace(/\{\{\s*discount\s*\}\}/gi, Number(invoice.discount).toFixed(2))
      .replace(/\{\{\s*total\s*\}\}/gi, Number(invoice.total).toFixed(2));

    // Handle items placeholder
    if (html.includes("{{items}}")) {
      html = html.replace(/\{\{\s*items\s*\}\}/gi, itemsHtml);
    }
  } else {
    html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color:#111; padding:24px }
            .header { display:flex; justify-content:space-between; align-items:center }
            .invoice-box { max-width:800px; margin:0 auto }
            table { width:100%; border-collapse:collapse }
            th, td { padding:8px 6px }
            .totals td { border-top:1px solid #ddd }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div>
                <h2>Go Experts</h2>
                <div>Billing: ${user.fullName || ""}</div>
                <div>${user.email || ""}</div>
              </div>
              <div style="text-align:right">
                <h3>Invoice</h3>
                <div><strong>#${invoice.invoiceNumber}</strong></div>
                <div>${new Date(invoice.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            <hr />

            <table>
              <thead>
                <tr><th style="text-align:left">Description</th><th style="text-align:right">Amount</th></tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot class="totals">
                <tr><td style="text-align:left">Subtotal</td><td style="text-align:right">${Number(invoice.subtotal).toFixed(2)}</td></tr>
                <tr><td style="text-align:left">GST</td><td style="text-align:right">${Number(invoice.gst).toFixed(2)}</td></tr>
                <tr><td style="text-align:left">Discount</td><td style="text-align:right">${Number(invoice.discount).toFixed(2)}</td></tr>
                <tr><td style="text-align:left"><strong>Total</strong></td><td style="text-align:right"><strong>${Number(invoice.total).toFixed(2)}</strong></td></tr>
              </tfoot>
            </table>
          </div>
        </body>
      </html>
    `;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.pdf({ path: filePath, format: "A4", printBackground: true });
  await page.close();
  await context.close();
  await browser.close();

  await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath: publicPath } });

  return { filePath, publicPath };
}
