// ============================================================================
// BARUNA Academy — Certificate, Digital Badge & Transcript generation
// ----------------------------------------------------------------------------
// Fully client-side. The certificate and badge are drawn on a canvas (with a QR
// verification code) and exported as a PDF / PNG. The transcript is a text PDF.
// No backend required.
// ============================================================================

import { downloadBlob, buildImagePdf, dataUrlToBytes, downloadPdf } from "./downloads";


// BARUNA palette (approximate sRGB of the design tokens).
const NAVY = "#16275f";
const MARINE = "#2f49d8";
const TEAL = "#39b3a6";
const INK = "#3b455c";
const LIGHT = "#f5f8fc";

export type CertificateData = {
  name: string;
  country: string;
  program: string;
  dates: string;
  certNo: string;
  verifyUrl: string;
};

export type TranscriptScores = {
  preTest: number | null;
  modules: { no: number; title: string; score: number; passed: boolean }[];
  postTest: number | null;
  finalExam: number | null;
  overall: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Certificate ──────────────────────────────────────────────────────────────
async function renderCertificateCanvas(d: CertificateData): Promise<HTMLCanvasElement> {
  const W = 1240;
  const H = 877; // A4 landscape ratio
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(0, 0, W, H);

  // Borders
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 10;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  const cx = W / 2;
  ctx.textAlign = "center";

  // Brand
  ctx.fillStyle = MARINE;
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("B A R U N A   A C A D E M Y", cx, 120);

  // Title
  ctx.fillStyle = NAVY;
  ctx.font = "bold 56px Georgia, 'Times New Roman', serif";
  ctx.fillText("Certificate of Completion", cx, 200);

  // Divider
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 90, 222);
  ctx.lineTo(cx + 90, 222);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = "20px Arial, sans-serif";
  ctx.fillText("This is proudly presented to", cx, 285);

  // Name
  ctx.fillStyle = NAVY;
  ctx.font = "bold 50px Georgia, 'Times New Roman', serif";
  ctx.fillText(d.name || "Participant", cx, 350);

  ctx.fillStyle = MARINE;
  ctx.font = "18px Arial, sans-serif";
  ctx.fillText(d.country ? `Country: ${d.country}` : "", cx, 385);

  ctx.fillStyle = INK;
  ctx.font = "20px Arial, sans-serif";
  ctx.fillText("for successfully completing the", cx, 440);

  // Program (wrap to two lines if long)
  ctx.fillStyle = NAVY;
  ctx.font = "bold 30px Georgia, 'Times New Roman', serif";
  wrapText(ctx, d.program, cx, 485, W - 260, 38);

  ctx.fillStyle = INK;
  ctx.font = "18px Arial, sans-serif";
  ctx.fillText(`Training Period: ${d.dates}`, cx, 580);

  // Footer left: certificate number + verification
  ctx.textAlign = "left";
  ctx.fillStyle = NAVY;
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText("Certificate No.", 110, 720);
  ctx.fillStyle = INK;
  ctx.font = "15px Arial, sans-serif";
  ctx.fillText(d.certNo, 110, 744);
  ctx.fillStyle = INK;
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText("Verify authenticity by scanning the QR code.", 110, 770);

  // Footer center: signature line
  ctx.textAlign = "center";
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 120, 735);
  ctx.lineTo(cx + 120, 735);
  ctx.stroke();
  ctx.fillStyle = NAVY;
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText("Program Director", cx, 760);
  ctx.fillStyle = INK;
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText("BARUNA Academy", cx, 780);

  // QR code (right)
  try {
    const QRCode = (await import("qrcode")).default;
    const qrUrl = await QRCode.toDataURL(d.verifyUrl, { margin: 1, width: 240 });
    const qr = await loadImage(qrUrl);
    ctx.drawImage(qr, W - 230, 670, 120, 120);
    ctx.fillStyle = INK;
    ctx.font = "12px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scan to verify", W - 170, 808);
  } catch {
    /* QR generation is best-effort */
  }

  return canvas;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

export async function downloadCertificatePdf(d: CertificateData) {
  const canvas = await renderCertificateCanvas(d);
  const jpeg = canvas.toDataURL("image/jpeg", 0.92);
  const bytes = dataUrlToBytes(jpeg);
  // A4 landscape in PDF points.
  const blob = buildImagePdf(bytes, canvas.width, canvas.height, 842, 595);
  downloadBlob("baruna-certificate.pdf", blob);
}

// ── Digital Badge ────────────────────────────────────────────────────────────
function renderBadgeCanvas(): HTMLCanvasElement {
  const S = 600;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const c = S / 2;

  // Outer ring
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, MARINE);
  grad.addColorStop(1, NAVY);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, 290, 0, Math.PI * 2);
  ctx.fill();

  // Inner circle
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(c, c, 235, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = TEAL;
  ctx.beginPath();
  ctx.arc(c, c, 222, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(c, c, 210, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = MARINE;
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("BARUNA ACADEMY", c, c - 120);

  // Star / medal mark
  ctx.fillStyle = NAVY;
  ctx.font = "bold 90px Georgia, serif";
  ctx.fillText("★", c, c - 20);

  ctx.fillStyle = NAVY;
  ctx.font = "bold 26px Georgia, 'Times New Roman', serif";
  ctx.fillText("International Fisheries", c, c + 60);
  ctx.fillText("Training Graduate", c, c + 95);

  ctx.fillStyle = TEAL;
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText("CERTIFIED 2026", c, c + 150);

  return canvas;
}

export function downloadBadgePng() {
  const canvas = renderBadgeCanvas();
  canvas.toBlob((blob) => {
    if (blob) downloadBlob("baruna-fisheries-graduate-badge.png", blob);
  }, "image/png");
}

// ── Learning Transcript ──────────────────────────────────────────────────────
export function downloadTranscriptPdf(d: CertificateData, s: TranscriptScores) {
  const lines: string[] = [
    "BARUNA Academy — Official Learning Transcript",
    "",
    `Participant: ${d.name}`,
    `Country: ${d.country}`,
    `Program: ${d.program}`,
    `Training Period: ${d.dates}`,
    `Certificate No.: ${d.certNo}`,
    "",
    "Assessment Results",
    "------------------------------------------",
    `Pre-Test Score: ${s.preTest === null ? "—" : s.preTest + "%"}`,
    "",
    "Module Quiz Scores:",
    ...s.modules.map((m) => `  M${m.no}. ${truncate(m.title, 42)} — ${m.score}% (${m.passed ? "Passed" : "Not passed"})`),
    "",
    `Post-Test Score: ${s.postTest === null ? "—" : s.postTest + "%"}`,
    `Final Examination Score: ${s.finalExam === null ? "—" : s.finalExam + "%"}`,
    "------------------------------------------",
    `Overall Score: ${s.overall}%`,
    `Completion Date: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    "",
    "This transcript is issued electronically by BARUNA Academy.",
  ];
  downloadPdf("baruna-transcript.pdf", "Learning Transcript", lines);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
