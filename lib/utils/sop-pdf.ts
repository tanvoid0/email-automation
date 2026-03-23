/**
 * Open a new window with the SOP content and trigger print.
 * User can choose "Save as PDF" in the print dialog.
 * No external PDF library required.
 */
export function downloadSOPAsPDF(title: string, content: string, _filename?: string): void {
  const paragraphs = content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.6; max-width: 21cm; margin: 2cm auto; padding: 0 1.5rem; color: #1a1a1a; }
    h1 { font-size: 18pt; margin-bottom: 1rem; }
    p { margin-bottom: 1rem; text-align: justify; }
    @media print { body { margin: 1.5cm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n")}
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    throw new Error("Popup blocked. Please allow popups to download as PDF, then use Print → Save as PDF.");
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => {
    w.print();
    w.onafterprint = () => w.close();
  };
}

function escapeHtml(text: string): string {
  const div = { innerHTML: "" };
  const el = document.createElement("div");
  el.textContent = text;
  return el.innerHTML;
}
