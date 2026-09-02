// ============================================================================
// BARUNA — lightweight client-side download helpers
// Used for "Download PDF", "Download Schedule" and "Add to Calendar" actions
// on the training detail page. No backend required.
// ============================================================================

export function downloadBlob(filename: string, blob: Blob) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build a minimal, valid single-page PDF from a title and lines of text. */
export function buildSimplePdf(title: string, lines: string[]): Blob {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c);

  let stream = "BT\n/F1 20 Tf\n1 0 0 1 50 790 Tm\n(" + esc(title) + ") Tj\n/F1 11 Tf\n";
  let y = 758;
  for (const line of lines) {
    stream += `1 0 0 1 50 ${y} Tm\n(${esc(line)}) Tj\n`;
    y -= 18;
    if (y < 40) break;
  }
  stream += "ET";

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += String(off).padStart(10, "0") + " 00000 n \n";
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadPdf(filename: string, title: string, lines: string[]) {
  downloadBlob(filename, buildSimplePdf(title, lines));
}

// ── Image-embedded PDF (used for the certificate) ───────────────────────────
function latin1Bytes(s: string): Uint8Array {
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff;
  return a;
}

/** Converts a base64 data URL (e.g. canvas.toDataURL) into raw bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

/**
 * Builds a single-page PDF that fills the page with one JPEG image. Used to wrap
 * a rendered certificate canvas into a downloadable PDF without any dependency.
 */
export function buildImagePdf(
  jpeg: Uint8Array,
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
): Blob {
  const chunks: Uint8Array[] = [];
  let len = 0;
  const offsets: number[] = [];
  const push = (u: Uint8Array | string) => {
    const b = typeof u === "string" ? latin1Bytes(u) : u;
    chunks.push(b);
    len += b.length;
  };
  const mark = () => offsets.push(len);

  push("%PDF-1.4\n");
  mark();
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  mark();
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  mark();
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  mark();
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  mark();
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefStart = len;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, "0") + " 00000 n \n";
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}


/** Build a multi-day all-day .ics calendar file. days = [{ dateISO, summary, description }] */
export function downloadScheduleICS(
  filename: string,
  days: { dateISO: string; summary: string; description: string }[],
) {
  const stamp = (iso: string) => iso.replace(/-/g, "");
  const nextDay = (iso: string) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10).replace(/-/g, "");
  };
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BARUNA//Training//EN",
    ...days.flatMap((d, i) => [
      "BEGIN:VEVENT",
      `UID:baruna-training-${i}-${stamp(d.dateISO)}@baruna.id`,
      `DTSTART;VALUE=DATE:${stamp(d.dateISO)}`,
      `DTEND;VALUE=DATE:${nextDay(d.dateISO)}`,
      `SUMMARY:${d.summary}`,
      `DESCRIPTION:${d.description.replace(/\n/g, " ")}`,
      "LOCATION:Bali, Indonesia",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  downloadBlob(filename, new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
}

export function barunaToast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("baruna:toast", { detail: { message } }));
}
