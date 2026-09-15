export function baseEmailLayout(title: string, innerHtml: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body {
        font-family: 'Inter', Arial, sans-serif;
        background-color: #f9fafb;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        border: 1px solid #f3f4f6;
      }
      .header {
        background-color: #111827;
        padding: 32px 40px;
        text-align: center;
      }
      .header h1 {
        color: #ffffff;
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.025em;
      }
      .content {
        padding: 40px;
        color: #374151;
        line-height: 1.6;
        font-size: 16px;
      }
      .footer {
        background-color: #f9fafb;
        padding: 32px 40px;
        text-align: center;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 13px;
      }
      .btn {
        display: inline-block;
        background-color: #e30613;
        color: #ffffff !important;
        text-decoration: none;
        padding: 12px 28px;
        border-radius: 6px;
        font-weight: 600;
        margin-top: 24px;
        margin-bottom: 8px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Go Experts</h1>
      </div>
      <div class="content">
        ${innerHtml}
      </div>
      <div class="footer">
        <p> 2026 Go Experts Connect. All rights reserved.</p>
        <p>You received this email because you are registered on Go Experts.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}
