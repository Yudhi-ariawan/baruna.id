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
  country?: string;
  program: string;
  dates: string;
  certNo: string;
  verifyUrl: string;
  photoUrl?: string | null;
  nip?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  pangkatGolongan?: string | null;
  jabatan?: string | null;
  instansi?: string | null;
  workUnit?: string | null;
  learningHours?: number | string | null;
  signerName?: string;
  signerRole?: string;
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
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function formatTodayIndonesian(): string {
  const now = new Date();
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

export function numberToIndonesianWords(n: number): string {
  const words = [
    "nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan",
    "sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas",
    "tujuh belas", "delapan belas", "sembilan belas", "dua puluh",
  ];
  if (n >= 0 && n < words.length) return words[n];
  if (n === 24) return "dua puluh empat";
  if (n === 32) return "tiga puluh dua";
  return String(n);
}

export function formatTanggalIndo(str?: string | null): string {
  if (!str) return "-";
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const day = parseInt(ymdMatch[3], 10);
    const month = months[parseInt(ymdMatch[2], 10) - 1] || ymdMatch[2];
    const year = ymdMatch[1];
    return `${day} ${month} ${year}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = months[parseInt(dmyMatch[2], 10) - 1] || dmyMatch[2];
    const year = dmyMatch[3];
    return `${day} ${month} ${year}`;
  }
  return str;
}


// ── Certificate ──────────────────────────────────────────────────────────────
async function renderCertificateCanvas(d: CertificateData): Promise<HTMLCanvasElement> {
  const W = 1040;
  const H = 726; // Exact aspect ratio of official template (1040x726)
  const scale = 2; // Hi-DPI 2x scale for print sharpness
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Default white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  let templateImg: HTMLImageElement | null = null;
  try {
    templateImg = await loadImage("/template-sttp-sementara.jpeg");
  } catch {
    try {
      templateImg = await loadImage("/template sementara.jpeg");
    } catch {
      templateImg = null;
    }
  }

  const hours = Number(d.learningHours) || 8;
  const hoursWord = numberToIndonesianWords(hours);
  const formattedTanggalLahir = formatTanggalIndo(d.tanggalLahir);
  const instansiText = d.instansi || d.workUnit || "Kementerian Kelautan dan Perikanan";

  if (templateImg) {
    // 1. Draw base official STTP template
    ctx.drawImage(templateImg, 0, 0, W, H);

    // 2. White out dynamic regions for clean, crisp re-rendering
    // 2a. Nomor Surat
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(260, 155, 520, 30);

    // 2b. Photo & Biodata block area
    ctx.fillRect(45, 252, 820, 185);

    // 2c. Course title & JP sentence area
    ctx.fillRect(45, 460, 950, 75);

    // 2d. Date above signature
    ctx.fillRect(720, 542, 280, 24);

    // 2e. QR Code area (bottom left)
    ctx.fillRect(55, 555, 115, 115);

    // 3. Render Dynamic Content matching template
    // 3a. Nomor Surat
    ctx.fillStyle = "#000000";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Nomor : ${d.certNo}`, W / 2, 175);

    // 3b. Pas Foto (Aspect ratio 3:4, formal red background frame)
    const photoX = 52;
    const photoY = 258;
    const photoW = 142;
    const photoH = 175;

    ctx.fillStyle = "#d32f2f"; // Official Indonesian red pas foto background
    ctx.fillRect(photoX, photoY, photoW, photoH);

    if (d.photoUrl) {
      try {
        const photoImg = await loadImage(d.photoUrl);
        ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
      } catch {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PAS FOTO", photoX + photoW / 2, photoY + photoH / 2 - 6);
        ctx.fillText("RESMI", photoX + photoW / 2, photoY + photoH / 2 + 12);
      }
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAS FOTO", photoX + photoW / 2, photoY + photoH / 2 - 6);
      ctx.fillText("RESMI", photoX + photoW / 2, photoY + photoH / 2 + 12);
    }

    ctx.strokeStyle = "#444444";
    ctx.lineWidth = 1;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    // 3c. Biodata 7 Rows Table
    const labelX = 235;
    const colonX = 395;
    const valueX = 410;
    const startY = 274;
    const rowHeight = 23;

    const rows = [
      { label: "Nama", value: d.name || "-" },
      { label: "NIP", value: d.nip || "-" },
      { label: "Tempat Lahir", value: d.tempatLahir || "-" },
      { label: "Tanggal Lahir", value: formattedTanggalLahir || "-" },
      { label: "Pangkat/ Gol. Ruang", value: d.pangkatGolongan || "-" },
      { label: "Jabatan", value: d.jabatan || "-" },
      { label: "Instansi", value: instansiText || "-" },
    ];

    ctx.textAlign = "left";
    rows.forEach((r, idx) => {
      const y = startY + idx * rowHeight;
      // Label
      ctx.fillStyle = "#000000";
      ctx.font = "13px Arial, sans-serif";
      ctx.fillText(r.label, labelX, y);
      // Colon
      ctx.fillText(":", colonX, y);
      // Value
      ctx.font = idx === 0 ? "bold 13.5px Arial, sans-serif" : "13px Arial, sans-serif";
      ctx.fillText(r.value, valueX, y);
    });

    // 3d. Course Title (Bold Centered)
    ctx.textAlign = "center";
    ctx.fillStyle = "#000000";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText(d.program, W / 2, 480);

    // 3e. JP Sentence
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(
      `oleh Balai Diklat Aparatur Kementerian Kelautan dan Perikanan metode full e-learning meliputi ${hours} (${hoursWord}) jam pelajaran (JP).`,
      W / 2,
      516,
    );

    // 3f. Date above signature
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(d.dates || formatTodayIndonesian(), 850, 558);

    // 3g. Dynamic Scannable QR Code
    try {
      const QRCode = (await import("qrcode")).default;
      const qrUrl = await QRCode.toDataURL(d.verifyUrl, { margin: 1, width: 200 });
      const qr = await loadImage(qrUrl);
      ctx.drawImage(qr, 65, 565, 95, 95);
    } catch {}
  } else {
    // ── Fallback standalone renderer (if image not accessible) ────────────
    renderStandaloneTemplate(ctx, d, W, H, hours, hoursWord, formattedTanggalLahir, instansiText);
  }

  return canvas;
}

function renderStandaloneTemplate(
  ctx: CanvasRenderingContext2D,
  d: CertificateData,
  W: number,
  H: number,
  hours: number,
  hoursWord: string,
  formattedTanggalLahir: string,
  instansiText: string,
) {
  // Border
  ctx.strokeStyle = "#16275f";
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  ctx.textAlign = "center";
  ctx.fillStyle = "#000000";

  // Header Title
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("SURAT TANDA TAMAT PELATIHAN", W / 2, 120);

  ctx.font = "13px Arial, sans-serif";
  ctx.fillText(`Nomor : ${d.certNo}`, W / 2, 145);

  // Legal statement
  ctx.font = "12px Arial, sans-serif";
  wrapText(
    ctx,
    "Pusat Pelatihan dan Penyuluhan Kelautan dan Perikanan berdasarkan Undang-undang Nomor 20 Tahun 2023 tentang Aparatur Sipil Negara, serta ketentuan pelaksanaannya menyatakan bahwa :",
    W / 2,
    185,
    W - 120,
    18,
  );

  // Pas foto
  const photoX = 65;
  const photoY = 240;
  const photoW = 135;
  const photoH = 175;
  ctx.fillStyle = "#d32f2f";
  ctx.fillRect(photoX, photoY, photoW, photoH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.fillText("PAS FOTO RESMI", photoX + photoW / 2, photoY + photoH / 2);
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1;
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  // Biodata Table
  const labelX = 240;
  const colonX = 400;
  const valueX = 415;
  const startY = 255;
  const rowHeight = 24;

  const rows = [
    { label: "Nama", value: d.name || "-" },
    { label: "NIP", value: d.nip || "-" },
    { label: "Tempat Lahir", value: d.tempatLahir || "-" },
    { label: "Tanggal Lahir", value: formattedTanggalLahir || "-" },
    { label: "Pangkat/ Gol. Ruang", value: d.pangkatGolongan || "-" },
    { label: "Jabatan", value: d.jabatan || "-" },
    { label: "Instansi", value: instansiText || "-" },
  ];

  ctx.textAlign = "left";
  rows.forEach((r, idx) => {
    const y = startY + idx * rowHeight;
    ctx.fillStyle = "#000000";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(r.label, labelX, y);
    ctx.fillText(":", colonX, y);
    ctx.font = idx === 0 ? "bold 13.5px Arial, sans-serif" : "13px Arial, sans-serif";
    ctx.fillText(r.value, valueX, y);
  });

  // Completion Text
  ctx.textAlign = "center";
  ctx.fillStyle = "#000000";
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText("Telah mengikuti pengembangan kompetensi melalui pelatihan :", W / 2, 455);

  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText(d.program, W / 2, 485);

  ctx.font = "13px Arial, sans-serif";
  ctx.fillText(
    `oleh Balai Diklat Aparatur Kementerian Kelautan dan Perikanan metode full e-learning meliputi ${hours} (${hoursWord}) jam pelajaran (JP).`,
    W / 2,
    515,
  );

  // Date and Signer
  ctx.fillText(d.dates || formatTodayIndonesian(), 840, 560);
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText("Kepala Pusat Pelatihan Kelautan dan Perikanan", 840, 580);
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText(d.signerName || "Lilly Aprilya Pregiwati", 840, 680);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = (text || "").split(" ");
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
  const jpeg = canvas.toDataURL("image/jpeg", 0.95);
  const bytes = dataUrlToBytes(jpeg);
  // A4 landscape in PDF points (842 x 595).
  const blob = buildImagePdf(bytes, canvas.width, canvas.height, 842, 595);
  const safeFilename = `STTP-${(d.name || "Peserta").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  downloadBlob(safeFilename, blob);
}

export async function openCertificatePdf(d: CertificateData) {
  const canvas = await renderCertificateCanvas(d);
  const jpeg = canvas.toDataURL("image/jpeg", 0.95);
  const bytes = dataUrlToBytes(jpeg);
  const blob = buildImagePdf(bytes, canvas.width, canvas.height, 842, 595);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
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
