// Temporary certificate sheet for Course Offering certificates (CATATAN_PERBAIKAN 2ap).
//
// Deliberately neutral until the official STTP is decided by the mentor: no
// stamp, no signature, no official's name, no institution's legal wording, and
// no background image (the old template in public/ contains personal data and a
// stamp). Every sheet carries "SEMENTARA / CONTOH" marks and a QR code to the
// public verification page, which is the actual proof.
import { buildImagePdf, dataUrlToBytes, downloadBlob } from "@/lib/downloads";
import type { CertificateSheetData } from "@/lib/learning/certificate-sheet.functions";

const NAVY = "#16275f";
const MARINE = "#2f49d8";
const TEAL = "#39b3a6";
const INK = "#3b455c";
const RED = "#b91c1c";
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function tanggal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Centered text, wrapped to maxWidth and at most maxLines (last line ends with "…"). */
function centered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2): number {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = shown[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    shown[maxLines - 1] = `${last}…`;
  }
  ctx.textAlign = "center";
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + (shown.length - 1) * lineHeight;
}

export async function renderSheet(d: CertificateSheetData, verifyUrl: string): Promise<HTMLCanvasElement> {
  const W = 1123, H = 794, scale = 2; // A4 landscape ratio
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background and frame.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // Header.
  ctx.fillStyle = MARINE;
  ctx.textAlign = "center";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("BARUNA ACADEMY", W / 2, 96);
  ctx.fillStyle = INK;
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText("Indonesia's Marine and Fisheries Knowledge & Capacity Building Network", W / 2, 118);

  ctx.fillStyle = NAVY;
  ctx.font = "bold 40px Arial, sans-serif";
  ctx.fillText("SERTIFIKAT PENYELESAIAN", W / 2, 182);
  ctx.fillStyle = INK;
  ctx.font = "italic 16px Arial, sans-serif";
  ctx.fillText("Certificate of Completion", W / 2, 208);
  ctx.font = "14px Arial, sans-serif";
  ctx.fillText(`Nomor: ${d.certificateNumber}`, W / 2, 238);

  // Recipient.
  ctx.font = "16px Arial, sans-serif";
  ctx.fillText("Diberikan kepada", W / 2, 292);
  ctx.fillStyle = NAVY;
  ctx.font = "bold 36px Arial, sans-serif";
  centered(ctx, d.participantName, W / 2, 340, W - 260, 42, 1);
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 260, 358);
  ctx.lineTo(W / 2 + 260, 358);
  ctx.stroke();

  // Course.
  ctx.fillStyle = INK;
  ctx.font = "16px Arial, sans-serif";
  ctx.fillText("atas penyelesaian course", W / 2, 396);
  ctx.fillStyle = NAVY;
  ctx.font = "bold 24px Arial, sans-serif";
  let y = centered(ctx, d.courseTitle, W / 2, 432, W - 240, 30, 2);
  const sub = [d.offeringTitle, d.cohortName].filter(Boolean).join(" · ");
  if (sub) {
    ctx.fillStyle = INK;
    ctx.font = "15px Arial, sans-serif";
    y = centered(ctx, sub, W / 2, y + 28, W - 240, 20, 1);
  }
  ctx.fillStyle = INK;
  ctx.font = "15px Arial, sans-serif";
  const facts = [`${d.moduleCount} modul`, d.totalHours ? `${String(d.totalHours).replace(".", ",")} jam pelajaran` : null, `diterbitkan ${tanggal(d.issueDate)}`].filter(Boolean).join("  ·  ");
  ctx.fillText(facts, W / 2, y + 32);

  // QR to the verification page (the real proof).
  try {
    const QRCode = (await import("qrcode")).default;
    const qr = await loadImage(await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 }));
    ctx.drawImage(qr, 84, H - 214, 120, 120);
  } catch {
    // QR is a convenience; the printed URL below still works.
  }
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillText("Periksa keaslian sertifikat:", 218, H - 180);
  ctx.font = "12px Arial, sans-serif";
  centeredLeft(ctx, verifyUrl, 218, H - 162, 360, 16);

  // Signature area left empty on purpose.
  const bx = W - 404, by = H - 214, bw = 320, bh = 120;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = "#9aa3b5";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.setLineDash([]);
  ctx.fillStyle = "#8a93a6";
  ctx.textAlign = "center";
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText("Tanda tangan dan stempel", bx + bw / 2, by + bh / 2 - 8);
  ctx.fillText("pejabat berwenang belum ditetapkan", bx + bw / 2, by + bh / 2 + 12);

  // Temporary marks: watermark + footer.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 9);
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = RED;
  ctx.textAlign = "center";
  ctx.font = "bold 110px Arial, sans-serif";
  ctx.fillText("SEMENTARA", 0, -20);
  ctx.font = "bold 58px Arial, sans-serif";
  ctx.fillText("CONTOH / BELUM RESMI", 0, 56);
  ctx.restore();
  ctx.fillStyle = RED;
  ctx.textAlign = "center";
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.fillText("LEMBAR SEMENTARA — belum ditandatangani pejabat berwenang dan belum berlaku sebagai STTP. Keaslian hanya dapat dipastikan lewat halaman verifikasi.", W / 2, H - 56);
  return canvas;
}

function centeredLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  // URLs have no spaces: break by characters.
  let line = "";
  let row = 0;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      line = ch;
      row++;
      if (row > 2) return;
    } else line += ch;
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight);
}

async function toPdf(d: CertificateSheetData): Promise<Blob> {
  const verifyUrl = new URL(d.verificationPath, window.location.origin).toString();
  const canvas = await renderSheet(d, verifyUrl);
  const bytes = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.95));
  return buildImagePdf(bytes, canvas.width, canvas.height, 842, 595);
}

/**
 * Opens the sheet in a new tab. The tab is opened synchronously inside the click
 * (browsers block tabs opened after an await); without a tab the PDF is downloaded.
 */
export async function openCertificateSheet(load: () => Promise<CertificateSheetData>) {
  const win = window.open("", "_blank");
  try {
    const d = await load();
    const blob = await toPdf(d);
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else downloadBlob(`Sertifikat-SEMENTARA-${d.certificateNumber}.pdf`, blob);
  } catch (e) {
    win?.close();
    throw e;
  }
}

export async function downloadCertificateSheet(d: CertificateSheetData) {
  const blob = await toPdf(d);
  downloadBlob(`Sertifikat-SEMENTARA-${d.certificateNumber}.pdf`, blob);
}
