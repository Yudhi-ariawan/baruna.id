import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPdf } from "./pdf-generator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../public/sample-module-files");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log("=== Generating Official BARUNA Academy Sample Module Materials ===");

// ==============================================================================
// 1. COMPLETE MODULE DOCUMENT (PDF) - Comprehensive Multi-Page Handbook
// ==============================================================================
const moduleDocPath = path.join(outDir, "Complete_Module_Document_Maritime_English.pdf");

createPdf({
  filepath: moduleDocPath,
  title: "MINISTRY PROFESSIONAL ENGLISH PROGRAM",
  subtitle: "Maritime English for Bilateral Marine Diplomacy & Fisheries Enforcement (MOD-ENG-KKP-01)",
  isLandscape: false,
  headerTitle: "BARUNA ACADEMY - BADAN PENYULUHAN & PENGEMBANGAN SDM KKP",
  footerText: "Buku Naskah Modul Pembelajaran Resmi - BARUNA Academy",
  sections: [
    [
      "INFORMASI MODUL & AKREDITASI KOMPETENSI",
      [
        "Kode Modul: MOD-ENG-KKP-01 | Beban Belajar: 8 Jam Pelajaran (8 JP / 360 Menit)",
        "Rumpun Bidang: Hubungan Internasional, Diplomasi Maritim & Pengawasan Sumber Daya Kelautan",
        "Target Peserta: Aparatur Sipil Negara, Pengawas Perikanan, Negosiator Maritim, dan Calon Instruktur",
        "Standar Acuan Global: IMO Model Course 3.17 (Maritime English) & Konvensi PBB UNCLOS 1982",
        "Ambang Batas Kelulusan: Minimum Nilai Evaluasi 70% untuk Penerbitan Sertifikat Kelulusan Resmi"
      ]
    ],
    [
      "BAB I: PENDAHULUAN & KERANGKA PEMBELAJARAN (INTRODUCTION)",
      [
        "1.1 Latar Belakang & Urgensi",
        "Indonesia sebagai poros maritim dunia memiliki yurisdiksi perairan seluas 6,4 juta kilometer persegi",
        "dengan perbatasan laut yang bersinggungan langsung dengan 10 negara tetangga. Penguasaan bahasa Inggris",
        "maritim standar bukan sekadar keterampilan bahasa asing, melainkan instrumen kedaulatan negara dalam",
        "menegakkan hukum perikanan, mengawasi kapal penangkap ikan berbendera asing, dan memimpin sidang regional.",
        "",
        "1.2 Tujuan Instruksional Pembelajaran",
        "Setelah menyelesaikan modul ini, peserta pelatihan diharapkan mampu secara mandiri:",
        "  - [1] Menguasai frasa baku pelayaran internasional (IMO Standard Marine Communication Phrases / SMCP).",
        "  - [2] Melakukan prosedur pemanggilan, identifikasi, dan peringatan radio VHF saluran 16 kepada kapal asing.",
        "  - [3] Memimpin proses boarding inspection (pemeriksaan langsung kapal) dengan terminologi hukum maritim.",
        "  - [4] Menyusun nota diplomasi bilateral dan laporan resmi penanganan IUU (Illegal, Unreported, Unregulated) Fishing.",
        "",
        "1.3 Peta Silabus & Tahapan Modul (Learning Roadmap)",
        "Modul terbagi menjadi 4 unit pembelajaran terstruktur dengan alokasi waktu setara 8 jam pelajaran tatap muka:",
        "  * Unit 1: Terminologi Standar IMO SMCP & Message Markers (2 JP)",
        "  * Unit 2: Komunikasi Radio Taktis VHF & Prosedur Intersepsi Laut (2 JP)",
        "  * Unit 3: Protokoler Negosiasi & Diplomasi Bilateral Perikanan (2 JP)",
        "  * Unit 4: Studi Kasus, Simulasi Sidang Multilateral & Asesmen Akhir (2 JP)"
      ]
    ],
    [
      "BAB II: STANDARD MARINE COMMUNICATION PHRASES (IMO SMCP)",
      [
        "2.1 Prinsip Dasar IMO Resolusi A.918(22)",
        "Frasa Baku Komunikasi Maritim (SMCP) diadopsi oleh International Maritime Organization untuk menghilangkan",
        "hambatan bahasa dan ambiguitaas dalam komunikasi navigasi dan keamanan laut antar-kapal internasional.",
        "",
        "2.2 Penggunaan Message Markers Baku (Penanda Jenis Pesan)",
        "Setiap transmisi radio resmi wajib diawali dengan penanda pesan (message marker) standar berikut:",
        "  * INSTRUCTION: Digunakan untuk instruksi yang mengikat secara hukum dari aparat penegak hukum laut.",
        "    Contoh: 'Instruction: Stop your vessel immediately and keep course on heading 090 degrees.'",
        "  * ADVICE: Digunakan untuk saran navigasi atau navigasi aman.",
        "    Contoh: 'Advice: Reduce your speed to 5 knots due to ongoing diver operations.'",
        "  * WARNING: Digunakan untuk peringatan bahaya atau pelanggaran wilayah perairan.",
        "    Contoh: 'Warning: You are navigating in Indonesian Territorial Waters without a valid permit.'",
        "  * INFORMATION: Digunakan untuk menyampaikan data fakta navigasi atau pengawasan.",
        "    Contoh: 'Information: Indonesian fisheries patrol vessel KP Orca 05 is alongside your port side.'",
        "  * QUESTION & ANSWER: Pasangan baku tanya jawab formal.",
        "    Contoh: 'Question: What is your fishing license number and registered call sign?'",
        "    Contoh: 'Answer: Fishing license number is SIPI-77821, call sign November Alpha Echo.'",
        "  * INTENTION: Pernyataan rencana aksi operasional aparat.",
        "    Contoh: 'Intention: I will send an armed boarding team for onboard fisheries verification.'"
      ]
    ],
    [
      "BAB III: KOMUNIKASI RADIO TAKTIS & INSPEKSI KAPAL (VESSEL INSPECTION)",
      [
        "3.1 Protokol Pemanggilan VHF Saluran 16 (Standard Hailing Protocol)",
        "Pemanggilan kapal asing wajib mengikuti urutan nama kapal target disebut 3 kali, diakhiri nama kapal patroli:",
        "  'FV Sea Dragon 01, FV Sea Dragon 01, FV Sea Dragon 01.'",
        "  'This is Indonesian Fisheries Patrol KP Orca 05, KP Orca 05, KP Orca 05.'",
        "  'Switch to working channel VHF 72 for official fisheries inspection. Over.'",
        "",
        "3.2 Naskah Pemeriksaan di Atas Kapal (On-Board Boarding Inspection Script)",
        "Saat tim pemeriksa (boarding team) menaiki kapal, pimpinan tim wajib menyapa nakhoda secara profesional:",
        "  'Captain, I am Inspector Rahmat from the Indonesian Marine and Fisheries Surveillance Authority.'",
        "  'We are conducting a routine verification under Indonesian Fisheries Law and UNCLOS 1982.'",
        "  'Please assemble your ship documents, fishing logbook, crew manifest, and catch certificates.'",
        "",
        "3.3 Dokumen Wajib yang Diperiksa (Official Document Checklist)",
        "  - [Dokumen 1] SIPI (Surat Izin Penangkapan Ikan / Valid Fishing Permit issued by KKP).",
        "  - [Dokumen 2] VMS Transponder Status (Perangkat Sistem Pemantauan Kapal harus aktif online).",
        "  - [Dokumen 3] Seafarer Identification Documents & Valid Maritime Working Agreements.",
        "  - [Dokumen 4] Fishing Gear Inspection (Ukuran mata jaring trawl dan kelengkapan ramah lingkungan)."
      ]
    ],
    [
      "BAB IV: DIPLOMASI KELAUTAN & PENANGANAN KASUS IUU FISHING",
      [
        "4.1 Kerangka Hukum Internasional UNCLOS 1982",
        "Aparatur KKP wajib memahami batas yurisdiksi dan status hukum perairan maritim:",
        "  - Laut Teritorial (Territorial Sea): 12 mil laut dari garis pangkal; kedaulatan penuh negara kepulauan.",
        "  - Zona Tambahan (Contiguous Zone): Hingga 24 mil laut; yurisdiksi fiskal, imigrasi, dan sanitasi.",
        "  - Zona Ekonomi Eksklusif (EEZ): Hingga 200 mil laut; hak berdaulat atas sumber daya hayati perikanan.",
        "",
        "4.2 Format Nota Diplomatik & Laporan Resmi (Diplomatic Brief Format)",
        "Setiap insiden penangkapan kapal asing dilaporkan dalam format diplomatik kepada Kementerian Luar Negeri:",
        "  * Section 1: Executive Summary (Waktu, koordinat geografis, nama kapal, bendera negara asal).",
        "  * Section 2: Narrative of Interception (Kronologis pemanggilan radio hingga tindakan boarding).",
        "  * Section 3: Evidence Inventory (Jumlah tonase ikan sitaan, alat tangkap terlarang, rekaman VMS/AIS).",
        "  * Section 4: Legal Grounds & Recommended Diplomatic Response (Pasal pelanggaran UU 31/2004 jo UU 45/2009)."
      ]
    ],
    [
      "BAB V: GLOSARIUM MARITIM & SINGKATAN INTERNASIONAL",
      [
        "Daftar istilah dan singkatan yang wajib dikuasai oleh setiap lulusan modul ini:",
        "  * UNCLOS: United Nations Convention on the Law of the Sea (Konvensi Hukum Laut PBB 1982).",
        "  * IUU Fishing: Illegal, Unreported, and Unregulated Fishing (Penangkapan Ikan Ilegal & Tak Teregulasi).",
        "  * IMO SMCP: International Maritime Organization Standard Marine Communication Phrases.",
        "  * RFMO: Regional Fisheries Management Organization (e.g. WCPFC, IOTC, CCSBT).",
        "  * PSMA: Port State Measures Agreement (Perjanjian Internasional Ketentuan Negara Pelabuhan).",
        "  * VMS: Vessel Monitoring System (Sistem Pemantauan Kapal Perikanan Berbasis Satelit).",
        "  * TAC: Total Allowable Catch (Jumlah Tangkapan yang Diperbolehkan per Wilayah Pengelolaan Perikanan).",
        "  * AIS: Automatic Identification System (Sistem Identifikasi Otomatis Navigasi Kapal)."
      ]
    ],
    [
      "BAB VI: EVALUASI PEMBELAJARAN & PERSYARATAN SERTIFIKASI",
      [
        "6.1 Bobot Penilaian Kelulusan Peserta",
        "Kelulusan peserta dinilai secara komprehensif melalui tiga komponen evaluasi terpadu:",
        "  - [Komponen A] Akses & Partisipasi Mandiri Materi LMS: 20% (Video Pembelajaran, Modul PDF, Slide)",
        "  - [Komponen B] Praktik Penulisan Diplomatic Brief & Latihan Taktis: 30% (Practical Exercise Rubric)",
        "  - [Komponen C] Asesmen Kuis Pengetahuan Akhir: 50% (Passing Grade Minimum: 70 dari 100 poin)",
        "",
        "6.2 Penerbitan Sertifikat Resmi BARUNA Academy",
        "Peserta yang berhasil mencapai nilai kumulatif >= 70% berhak memperoleh e-Certificate Terverifikasi",
        "dengan kode kredensial unik yang dapat diverifikasi langsung melalui portal resmi BARUNA Academy.",
        "Sertifikat ini menjadi portofolio resmi pengembangan kompetensi aparatur maritim Kementerian KKP."
      ]
    ]
  ]
});

// ==============================================================================
// 2. PRESENTATION SLIDES (PDF) - Slide Deck for in-browser visual viewer
// ==============================================================================
const slidesPdfPath = path.join(outDir, "Presentation_Slides_Maritime_English.pdf");

createPdf({
  filepath: slidesPdfPath,
  title: "MINISTRY PROFESSIONAL ENGLISH PROGRAM: LECTURE SLIDES",
  subtitle: "Visual Slide Deck for Guided Facilitation & Self-Paced Review (Course: MOD-ENG-KKP-01)",
  isLandscape: true,
  headerTitle: "BARUNA ACADEMY - OFFICIAL LECTURE SLIDE DECK",
  footerText: "Slide Presentasi Resmi - BARUNA Academy (Kementerian Kelautan dan Perikanan)",
  sections: [
    [
      "SLIDE 1: COURSE OVERVIEW & TARGET COMPETENCIES",
      [
        "[MODUL CODE: MOD-ENG-KKP-01] | Estimated Study Hours: 8 JP",
        "Facilitator: Marine & Fisheries Bilateral Communication Specialist",
        "",
        "Pillars of Competency Delivered in this Training Program:",
        "  * 1. Mastery of Standard Marine Communication Phrases (IMO SMCP Resolution A.918).",
        "  * 2. Standardized VHF Channel 16 radio calling, interception, and emergency signaling.",
        "  * 3. Boarding inspection procedures with legally grounded maritime English dialogues.",
        "  * 4. International fisheries law (UNCLOS 1982) and bilateral diplomatic brief formulation."
      ]
    ],
    [
      "SLIDE 2: GLOBAL REGULATORY ARCHITECTURE (UNCLOS & IMO)",
      [
        "Key Maritime Zones under United Nations Convention on the Law of the Sea (UNCLOS 1982):",
        "  - Internal Waters & Archipelagic Waters: Full sovereignty of the Republic of Indonesia.",
        "  - Territorial Sea (12 Nautical Miles): Full sovereign territory; innocent passage regime applies.",
        "  - Exclusive Economic Zone (EEZ, 200 Nautical Miles): Sovereign rights over living and non-living marine resources.",
        "",
        "Role of Maritime English in Safeguarding Sovereignty:",
        "  * Clear, unambiguous hailing prevents diplomatic misunderstandings with foreign maritime vessels.",
        "  * Legally precise inspection records provide admissible evidence in maritime courts and bilateral tribunals."
      ]
    ],
    [
      "SLIDE 3: IMO SMCP MESSAGE MARKERS & USAGE PROTOCOL",
      [
        "Standardized Prefixes for All Maritime Voice Transmissions:",
        "  * [INSTRUCTION] -> Direct orders issued under lawful sovereign authority (e.g. 'Stop vessel immediately').",
        "  * [ADVICE]      -> Operational navigation recommendations (e.g. 'Proceed to anchorage zone Bravo').",
        "  * [WARNING]     -> Alerts regarding violations or danger (e.g. 'You are operating in Indonesian EEZ without SIPI').",
        "  * [INFORMATION] -> Factual operational updates (e.g. 'Patrol boat is coming alongside on your starboard').",
        "  * [QUESTION]    -> Structured inquiries requiring standardized replies (e.g. 'What is your registered flag?').",
        "  * [ANSWER]      -> Direct, concise responses to standardized inquiries (e.g. 'Flag state is Panama').",
        "  * [REQUEST]     -> Formal procedural requests (e.g. 'Request permission to conduct boarding verification').",
        "  * [INTENTION]   -> Official notice of impending action (e.g. 'Intention: We will escort your vessel to port')."
      ]
    ],
    [
      "SLIDE 4: TACTICAL RADIO CALLS & INTERCEPTION SIMULATION",
      [
        "Standard VHF Channel 16 Calling Sequence (3x Hailing Formula):",
        "  1. 'Target Vessel Name (3x)' -> 'FV Ocean Star 12, FV Ocean Star 12, FV Ocean Star 12.'",
        "  2. 'Patrol Identifier (3x)' -> 'This is Indonesian Fisheries Patrol KP Orca 05 (3x).'",
        "  3. 'Channel Switch Order'   -> 'Switch to Working Channel VHF 72 immediately. Over.'",
        "",
        "Operational Script on Working Channel 72:",
        "  - 'Captain, state your origin port, destination port, and type of fishing license.'",
        "  - 'Heave to your vessel. We are preparing to launch a boarding party for fisheries inspection.'",
        "  - 'Ensure all ship personnel remain calm and keep hands visible on the main deck.'"
      ]
    ],
    [
      "SLIDE 5: ON-BOARD INSPECTION & EVIDENCE CHECKLIST",
      [
        "Critical Verification Checklist during Marine Surveillance Boarding:",
        "  * 1. Statutory Registration: Vessel nationality certificate, IMO number, call sign.",
        "  * 2. Fisheries Authorizations: SIPI (Surat Izin Penangkapan Ikan), SIKPI (Surat Izin Kapal Pengangkut Ikan).",
        "  * 3. Fishing Logbook Consistency: Verification between logged catch numbers and fish hold inventory.",
        "  * 4. VMS Transponder Health: Ensure the satellite tracking unit is fully powered and transmitting.",
        "  * 5. Gear Compliance: Net mesh size measurement, presence of turtle excluder devices (TED).",
        "",
        "Golden Rule of Facilitation: Always document all verbal interactions with timestamped bodycam footage."
      ]
    ],
    [
      "SLIDE 6: DIPLOMATIC CORRESPONDENCE & MULTILATERAL FORUMS",
      [
        "Four-Part Diplomatic Brief Structure for Ministerial Reporting:",
        "  - Part 1: Executive Summary & Geographic Positioning (Datum, Lat/Long, Nautical Zone).",
        "  - Part 2: Incident Chronology & Radio Transmission Log (Full transcript of VHF voice exchanges).",
        "  - Part 3: Physical & Digital Evidence Summary (Hold tonnages, gear seized, VMS tracks).",
        "  - Part 4: Recommended Action (Administrative sanction, diplomatic protest note, or judicial prosecution).",
        "",
        "Multilateral Negotiation Decorums:",
        "  * Address chairs formally: 'Distinguished Chairperson, esteemed delegates of member states...'",
        "  * Frame proposals around conservation: 'Indonesia advocates for transparent total allowable catch quotas...'"
      ]
    ],
    [
      "SLIDE 7: ASSESSMENT RUBRIC & FINAL CERTIFICATION",
      [
        "Evaluation Components for Course MOD-ENG-KKP-01:",
        "  * Digital Learning Participation: 20% (Complete Video Lectures, PDF Module Handbook, Slide Review)",
        "  * Practical Radio & Diplomatic Assignment: 30% (Submission evaluated using standard rubric)",
        "  * Final Assessment Knowledge Quiz: 50% (10 Multiple Choice & 2 Case Scenarios; Passing Score: 70%)",
        "",
        "Issuance of Official Digital Certificate:",
        "  - Verified blockchain-ready credential automatically generated upon passing all requirements.",
        "  - Accessible permanently via BARUNA Academy Learner Dashboard."
      ]
    ]
  ]
});

// ==============================================================================
// 3. PRESENTATION SLIDES (PPTX) - Real Microsoft PowerPoint OpenXML Archive
// ==============================================================================
console.log("Building Microsoft PowerPoint (.pptx) Presentation Archive...");

const pptxTempDir = path.resolve(__dirname, "../public/sample-module-files/temp_pptx_build");
if (fs.existsSync(pptxTempDir)) {
  fs.rmSync(pptxTempDir, { recursive: true, force: true });
}

// Create PPTX folder hierarchy
const dirsToCreate = [
  pptxTempDir,
  path.join(pptxTempDir, "_rels"),
  path.join(pptxTempDir, "ppt"),
  path.join(pptxTempDir, "ppt/_rels"),
  path.join(pptxTempDir, "ppt/slides"),
  path.join(pptxTempDir, "ppt/slides/_rels"),
  path.join(pptxTempDir, "ppt/slideLayouts"),
  path.join(pptxTempDir, "ppt/slideLayouts/_rels"),
  path.join(pptxTempDir, "ppt/slideMasters"),
  path.join(pptxTempDir, "ppt/slideMasters/_rels"),
  path.join(pptxTempDir, "ppt/theme"),
];
dirsToCreate.forEach((d) => fs.mkdirSync(d, { recursive: true }));

// 1. [Content_Types].xml
const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide5.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;
fs.writeFileSync(path.join(pptxTempDir, "[Content_Types].xml"), contentTypesXml, "utf8");

// 2. _rels/.rels
const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(pptxTempDir, "_rels/.rels"), rootRelsXml, "utf8");

// 3. ppt/presentation.xml
const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId2"/>
    <p:sldId id="257" r:id="rId3"/>
    <p:sldId id="258" r:id="rId4"/>
    <p:sldId id="259" r:id="rId5"/>
    <p:sldId id="260" r:id="rId6"/>
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
fs.writeFileSync(path.join(pptxTempDir, "ppt/presentation.xml"), presentationXml, "utf8");

// 4. ppt/_rels/presentation.xml.rels
const presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide4.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide5.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(pptxTempDir, "ppt/_rels/presentation.xml.rels"), presRelsXml, "utf8");

// 5. ppt/theme/theme1.xml
const theme1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="BARUNA Theme">
  <a:themeElements>
    <a:clrScheme name="BarunaColors">
      <a:dk1><a:srgbClr val="0A192F"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1A365D"/></a:dk2>
      <a:lt2><a:srgbClr val="F0F4F8"/></a:lt2>
      <a:accent1><a:srgbClr val="0284C7"/></a:accent1>
      <a:accent2><a:srgbClr val="0D9488"/></a:accent2>
      <a:accent3><a:srgbClr val="D97706"/></a:accent3>
      <a:accent4><a:srgbClr val="10B981"/></a:accent4>
      <a:accent5><a:srgbClr val="6366F1"/></a:accent5>
      <a:accent6><a:srgbClr val="EC4899"/></a:accent6>
      <a:hlink><a:srgbClr val="0284C7"/></a:hlink>
      <a:folHlink><a:srgbClr val="0369A1"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="BarunaFonts">
      <a:majorFont><a:latin typeface="Helvetica"/></a:majorFont>
      <a:minorFont><a:latin typeface="Helvetica"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="BarunaFormat">
      <a:fillStyleLst><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
fs.writeFileSync(path.join(pptxTempDir, "ppt/theme/theme1.xml"), theme1Xml, "utf8");

// 6. ppt/slideMasters/slideMaster1.xml & rels
const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;
fs.writeFileSync(path.join(pptxTempDir, "ppt/slideMasters/slideMaster1.xml"), slideMasterXml, "utf8");

const slideMasterRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(pptxTempDir, "ppt/slideMasters/_rels/slideMaster1.xml.rels"), slideMasterRelsXml, "utf8");

// 7. ppt/slideLayouts/slideLayout1.xml & rels
const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="titleAndContent">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
fs.writeFileSync(path.join(pptxTempDir, "ppt/slideLayouts/slideLayout1.xml"), slideLayoutXml, "utf8");

const slideLayoutRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
fs.writeFileSync(path.join(pptxTempDir, "ppt/slideLayouts/_rels/slideLayout1.xml.rels"), slideLayoutRelsXml, "utf8");

// 8. Generate 5 Rich Slides
function buildSlideXml(slideTitle, subtitle, bullets = []) {
  const bulletParagraphs = bullets
    .map(
      (b) => `
        <a:p>
          <a:pPr marL="288000" indent="-288000">
            <a:buFont typeface="Arial"/>
            <a:buChar char="•"/>
          </a:pPr>
          <a:r>
            <a:rPr lang="en-US" sz="1600">
              <a:solidFill><a:srgbClr val="334155"/></a:solidFill>
            </a:rPr>
            <a:t>${b.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c])}</a:t>
          </a:r>
        </a:p>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      <!-- Top Branding Bar Shape -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TopBar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="182880"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="0284C7"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Title & Subtitle Box -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="TitleBox"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="731520" y="548640"/><a:ext cx="10728960" cy="1371600"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="2800" b="1">
                <a:solidFill><a:srgbClr val="0A192F"/></a:solidFill>
              </a:rPr>
              <a:t>${slideTitle.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c])}</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1400" i="1">
                <a:solidFill><a:srgbClr val="0284C7"/></a:solidFill>
              </a:rPr>
              <a:t>${subtitle.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c])}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Body Content Box -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="ContentBox"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="731520" y="2103120"/><a:ext cx="10728960" cy="4023360"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          ${bulletParagraphs}
        </p:txBody>
      </p:sp>

      <!-- Bottom Footer Line & Text -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="5" name="Footer"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="731520" y="6309360"/><a:ext cx="10728960" cy="365760"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1000">
                <a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill>
              </a:rPr>
              <a:t>BARUNA Academy - Ministry Professional English Program | Kementerian Kelautan dan Perikanan</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

const slideData = [
  {
    title: "1. Ministry Professional English Program",
    subtitle: "Course: MOD-ENG-KKP-01 | Marine & Fisheries Sector",
    bullets: [
      "Designed for Indonesian fisheries surveillance officers, marine negotiators, and certified trainers.",
      "Grounded in United Nations Convention on the Law of the Sea (UNCLOS 1982) & IMO SMCP.",
      "Comprehensive training covering tactical radio voice communications, inspection checklists, and bilateral diplomatic briefs.",
      "Accredited under BARUNA Academy with verified digital credentials upon passing with score >= 70%."
    ]
  },
  {
    title: "2. International Legal Architecture & Marine Zones",
    subtitle: "Jurisdictional distinctions essential for official boarding and inspection",
    bullets: [
      "Archipelagic Waters & Territorial Sea (12 Nautical Miles): Full sovereignty of the Republic of Indonesia.",
      "Contiguous Zone (Up to 24 Nautical Miles): Sovereign authority for customs, fiscal, immigration, and sanitary laws.",
      "Exclusive Economic Zone (EEZ, 200 Nautical Miles): Sovereign rights over exploratory, exploitative, and conservation fisheries.",
      "Legal Accuracy in Communications: Clear language on VHF Ch. 16 prevents diplomatic escalation with foreign vessel flag states."
    ]
  },
  {
    title: "3. IMO Standard Marine Communication Phrases (SMCP)",
    subtitle: "Standardized Message Markers required for all VHF tactical voice transmissions",
    bullets: [
      "INSTRUCTION: Mandatory legal order issued by maritime law enforcement (e.g. 'Instruction: Stop your engines').",
      "WARNING: Formal notification of legal infringement (e.g. 'Warning: You are inside Indonesian EEZ without SIPI license').",
      "INFORMATION: Navigational and operational observations (e.g. 'Information: Patrol boarding team is in position').",
      "QUESTION & ANSWER: Paired protocol for gathering vessel registry, catch composition, and crew manifest details.",
      "INTENTION: Declaration of enforcement actions (e.g. 'Intention: We will board and inspect fish holds on deck')."
    ]
  },
  {
    title: "4. Tactical Interception & On-Board Inspection Script",
    subtitle: "Step-by-step communication procedure for marine boarding teams",
    bullets: [
      "Phase 1 - Initial Hailing: Call target vessel name 3x on VHF Channel 16 and instruct switch to working Channel 72.",
      "Phase 2 - Identification & Safety: Identify surveillance vessel, authority, and demand master gather all ship documents.",
      "Phase 3 - Document Verification: Validate SIPI fishing permits, satellite VMS transponder status, and crew work contracts.",
      "Phase 4 - Gear & Catch Verification: Inspect net mesh gauges, species catch composition, and compare with logged books."
    ]
  },
  {
    title: "5. Diplomatic Correspondence & Assessment Rubric",
    subtitle: "Structuring bilateral reporting and requirements for certificate eligibility",
    bullets: [
      "Four-Part Diplomatic Brief: Executive Summary, Incident Chronology, Physical Evidence Inventory, and Action Recommendations.",
      "Multilateral Forum Decorum: Standard formal addresses for RFMO conferences (WCPFC, IOTC, CCSBT).",
      "Assessment Protocol: Minimum 70% required on comprehensive 10-question quiz & practical scenario assignment.",
      "Credential Issuance: Official digital certificate awarded automatically upon successful verification."
    ]
  }
];

slideData.forEach((s, idx) => {
  const slideNum = idx + 1;
  fs.writeFileSync(
    path.join(pptxTempDir, `ppt/slides/slide${slideNum}.xml`),
    buildSlideXml(s.title, s.subtitle, s.bullets),
    "utf8"
  );

  const slideRelXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
  fs.writeFileSync(
    path.join(pptxTempDir, `ppt/slides/_rels/slide${slideNum}.xml.rels`),
    slideRelXml,
    "utf8"
  );
});

// Pack using PowerShell Compress-Archive into genuine .pptx
const pptxOutPath = path.join(outDir, "Presentation_Slides_Maritime_English.pptx");
const zipTempPath = path.join(outDir, "temp_pptx.zip");

if (fs.existsSync(pptxOutPath)) {
  fs.unlinkSync(pptxOutPath);
}
if (fs.existsSync(zipTempPath)) {
  fs.unlinkSync(zipTempPath);
}

try {
  const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${pptxTempDir}/*' -DestinationPath '${zipTempPath}' -Force"`;
  execSync(psCmd, { stdio: "inherit" });
  fs.renameSync(zipTempPath, pptxOutPath);
  console.log(`Generated: ${path.basename(pptxOutPath)} (${fs.statSync(pptxOutPath).size} bytes)`);
} finally {
  // Clean up unpacked folder
  if (fs.existsSync(zipTempPath)) {
    fs.unlinkSync(zipTempPath);
  }
  fs.rmSync(pptxTempDir, { recursive: true, force: true });
}

console.log("=== All Sample Module Files Generated Successfully! ===");
