import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../public/sample-module-files");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// -------------------------------------------------------------
// Pure Node.js PDF-1.4 Generator (Zero External Dependencies)
// -------------------------------------------------------------
export function createPdf({
  filepath,
  title,
  subtitle,
  isLandscape = false,
  sections = [],
  headerTitle = "BARUNA ACADEMY - KEMENTERIAN KELAUTAN DAN PERIKANAN",
  footerText = "Dokumen Resmi Modul Pelatihan BARUNA Academy",
}) {
  const page_w = isLandscape ? 842 : 595;
  const page_h = isLandscape ? 595 : 842;
  const margin_x = 48;
  const margin_top = page_h - 60;
  const line_h = isLandscape ? 18 : 14;

  const pages = [];
  let curr_lines = [];
  let y = margin_top;

  function start_page() {
    curr_lines = [];
    y = margin_top;

    // Header bar
    curr_lines.push("q 0.08 0.22 0.38 rg 48 " + (page_h - 38) + " " + (page_w - 96) + " 2 re f Q");
    const safeHdr = headerTitle.replace(/[\\()]/g, "\\$&");
    curr_lines.push(`BT /F1 8 Tf 0.45 0.45 0.45 rg 48 ${page_h - 30} Td (${safeHdr}) Tj ET`);
  }

  function flush_page() {
    // Footer line & text
    curr_lines.push(`q 0.82 0.82 0.82 rg 48 42 ${page_w - 96} 1 re f Q`);
    const pageNum = pages.length + 1;
    const safeFtr = `${footerText} - Halaman ${pageNum}`.replace(/[\\()]/g, "\\$&");
    curr_lines.push(`BT /F1 7.5 Tf 0.5 0.5 0.5 rg 48 30 Td (${safeFtr}) Tj ET`);
    pages.push(curr_lines.join("\n"));
  }

  start_page();

  // Document Title
  const safeTitle = title.replace(/[\\()]/g, "\\$&");
  const safeSubtitle = subtitle.replace(/[\\()]/g, "\\$&");
  curr_lines.push(`BT /F2 16 Tf 0.05 0.15 0.3 rg ${margin_x} ${y} Td (${safeTitle}) Tj ET`);
  y -= 20;
  curr_lines.push(`BT /F1 9.5 Tf 0.2 0.5 0.6 rg ${margin_x} ${y} Td (${safeSubtitle}) Tj ET`);
  y -= 14;
  curr_lines.push(`q 0.2 0.5 0.6 rg ${margin_x} ${y} ${page_w - 96} 1.5 re f Q`);
  y -= 22;

  for (const [sec_title, sec_paragraphs] of sections) {
    if (y < 130) {
      flush_page();
      start_page();
    }

    const safeSecTitle = sec_title.replace(/[\\()]/g, "\\$&");
    curr_lines.push(`BT /F2 11 Tf 0.08 0.22 0.38 rg ${margin_x} ${y} Td (${safeSecTitle}) Tj ET`);
    y -= 16;

    for (const p of sec_paragraphs) {
      if (y < 60) {
        flush_page();
        start_page();
      }
      const safe_p = p.replace(/[\\()]/g, "\\$&");
      if (p.startsWith("  *") || p.startsWith("  -")) {
        curr_lines.push(`BT /F1 8.5 Tf 0.2 0.2 0.2 rg ${margin_x + 12} ${y} Td (${safe_p.trim()}) Tj ET`);
      } else if (p.startsWith("[") && p.includes("]")) {
        curr_lines.push(`BT /F2 8.5 Tf 0.1 0.3 0.5 rg ${margin_x} ${y} Td (${safe_p}) Tj ET`);
      } else {
        curr_lines.push(`BT /F1 8.5 Tf 0.18 0.18 0.18 rg ${margin_x} ${y} Td (${safe_p}) Tj ET`);
      }
      y -= line_h;
    }
    y -= 10;
  }

  flush_page();

  const total_pages = pages.length;
  const page_obj_ids = pages.map((_, i) => 5 + 2 * i);

  const catalog = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids_str = page_obj_ids.map((id) => `${id} 0 R`).join(" ");
  const pages_obj = `<< /Type /Pages /Kids [${kids_str}] /Count ${total_pages} >>`;
  const f1 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const f2 = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const all_objs = [catalog, pages_obj, f1, f2];

  for (let i = 0; i < total_pages; i++) {
    const p_stream = Buffer.from(pages[i], "latin1");
    const content_id = 6 + 2 * i;
    const page_dict = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page_w} ${page_h}] /Contents ${content_id} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    const content_dict = `<< /Length ${p_stream.length} >>\nstream\n${pages[i]}\nendstream`;
    all_objs.push(page_dict);
    all_objs.push(content_dict);
  }

  const parts = ["%PDF-1.4\n"];
  const offsets = [];

  let currentLen = Buffer.byteLength(parts[0], "latin1");
  for (let idx = 0; idx < all_objs.length; idx++) {
    offsets.push(currentLen);
    const objStr = `${idx + 1} 0 obj\n${all_objs[idx]}\nendobj\n`;
    parts.push(objStr);
    currentLen += Buffer.byteLength(objStr, "latin1");
  }

  const xref_offset = currentLen;
  let xref = `xref\n0 ${all_objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += off.toString().padStart(10, "0") + " 00000 n \n";
  }
  parts.push(xref);

  const trailer = `trailer\n<< /Size ${all_objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref_offset}\n%%EOF\n`;
  parts.push(trailer);

  const finalBuf = Buffer.from(parts.join(""), "latin1");
  fs.writeFileSync(filepath, finalBuf);
  console.log(`Generated: ${path.basename(filepath)} (${total_pages} pages, ${finalBuf.length} bytes)`);
}
