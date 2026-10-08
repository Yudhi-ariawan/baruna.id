import { useState } from "react";
import {
  ListChecks,
  Plus,
  Trash2,
  CheckCircle2,
  ClipboardPaste,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import type { CustomQuizQuestion } from "@/lib/learning/learning.functions";

type ModuleQuizBuilderProps = {
  questions: CustomQuizQuestion[];
  onChange: (questions: CustomQuizQuestion[]) => void;
  isId: boolean;
};

export function ModuleQuizBuilder({
  questions,
  onChange,
  isId,
}: ModuleQuizBuilderProps) {
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Add a new empty question
  const handleAddQuestion = () => {
    const newQ: CustomQuizQuestion = {
      id: Date.now(),
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      explanation: "",
    };
    onChange([...questions, newQ]);
  };

  // Update a question field
  const handleUpdateQuestion = (
    index: number,
    patch: Partial<CustomQuizQuestion>,
  ) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...patch };
    onChange(updated);
  };

  // Update a specific option for a question
  const handleUpdateOption = (
    qIndex: number,
    optIndex: number,
    value: string,
  ) => {
    const updated = [...questions];
    const opts = [...updated[qIndex].options];
    opts[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options: opts };
    onChange(updated);
  };

  // Remove a question
  const handleRemoveQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Move question up or down
  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === questions.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  // Smart Parser for Bulk Text Paste
  const handleProcessBulkPaste = () => {
    if (!bulkText.trim()) {
      setBulkError(isId ? "Teks naskah soal tidak boleh kosong." : "Question text cannot be empty.");
      return;
    }

    try {
      // Split text into lines
      const lines = bulkText.split(/\r?\n/).map((l) => l.trim());
      const parsed: CustomQuizQuestion[] = [];
      let currentQ: {
        question: string;
        options: string[];
        correctAnswer: number;
        explanation: string;
      } | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Detect Question start (e.g., "1. ", "1) ", "Soal 1:", etc.)
        const qMatch = line.match(/^(?:(?:\d+[\.\)])|soal\s*\d+[:\.]?)\s*(.+)/i);
        if (qMatch) {
          if (currentQ && currentQ.question && currentQ.options.length >= 2) {
            // Pad to 4 options if fewer
            while (currentQ.options.length < 4) {
              currentQ.options.push("-");
            }
            parsed.push({
              id: Date.now() + parsed.length,
              ...currentQ,
            });
          }
          currentQ = {
            question: qMatch[1].trim(),
            options: [],
            correctAnswer: 0,
            explanation: "",
          };
          continue;
        }

        // Detect Option (A., B., C., D. or a), b), c), d))
        const optMatch = line.match(/^(?:([A-Da-d])[\.\)]|\(([A-Da-d])\))\s*(.+)/);
        if (optMatch && currentQ) {
          const optLetter = (optMatch[1] || optMatch[2]).toUpperCase();
          const optText = optMatch[3].trim();
          currentQ.options.push(optText);
          continue;
        }

        // Detect Answer Key (Kunci: A, Jawaban: B, Key: C)
        const keyMatch = line.match(/(?:kunci|jawaban|answer|key)\s*[:\-=]?\s*([A-Da-d])/i);
        if (keyMatch && currentQ) {
          const letter = keyMatch[1].toUpperCase();
          const idx = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
          if (idx >= 0 && idx <= 3) {
            currentQ.correctAnswer = idx;
          }
          continue;
        }

        // Detect Explanation / Pembahasan
        const expMatch = line.match(/(?:pembahasan|penjelasan|explanation)\s*[:\-=]?\s*(.+)/i);
        if (expMatch && currentQ) {
          currentQ.explanation = expMatch[1].trim();
          continue;
        }

        // If line is continuation of question
        if (currentQ && currentQ.options.length === 0) {
          currentQ.question += ` ${line}`;
        }
      }

      // Add last question
      if (currentQ && currentQ.question && currentQ.options.length >= 2) {
        while (currentQ.options.length < 4) {
          currentQ.options.push("-");
        }
        parsed.push({
          id: Date.now() + parsed.length,
          ...currentQ,
        });
      }

      if (parsed.length === 0) {
        setBulkError(
          isId
            ? "Format tidak dikenali. Pastikan ada penomoran soal (1. ...) dan opsi pilihan (A. ..., B. ...)."
            : "Format not recognized. Ensure question numbers (1. ...) and options (A. ..., B. ...) exist.",
        );
        return;
      }

      onChange([...questions, ...parsed]);
      setBulkText("");
      setBulkError(null);
      setIsBulkPasteOpen(false);
    } catch {
      setBulkError(isId ? "Gagal memproses teks. Silakan periksa format naskah Anda." : "Failed to parse text. Please check format.");
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-marine/30 bg-marine/5 p-5 shadow-soft">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-marine text-white shadow-2xs">
              <ListChecks className="h-4 w-4" />
            </span>
            <h3 className="font-display text-sm font-bold text-navy">
              {isId ? "Bank Soal Kuis Pilihan Ganda (Interaktif)" : "Interactive Multiple-Choice Quiz Questions"}
            </h3>
            <span className="rounded-full bg-marine/15 px-2.5 py-0.5 text-[11px] font-bold text-marine">
              {questions.length} {isId ? "Soal Dibuat" : "Questions"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {isId
              ? "Soal yang Anda susun di sini akan otomatis dirender interaktif di LMS untuk dikerjakan dan dinilai langsung."
              : "Questions authored here are automatically rendered in the LMS player for interactive scoring."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBulkError(null);
              setIsBulkPasteOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-marine/30 bg-white px-3 py-2 text-xs font-semibold text-marine hover:bg-marine/10 transition shadow-2xs cursor-pointer"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            {isId ? "Tempel Cepat dari Naskah" : "Quick Bulk Paste"}
          </button>
          <button
            type="button"
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-3.5 py-2 text-xs font-bold text-white hover:bg-navy/90 transition shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            {isId ? "Tambah Butir Soal" : "Add Question"}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {questions.length === 0 && (
        <div className="rounded-xl border border-dashed border-marine/40 bg-white/70 p-6 text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-marine/70" />
          <h4 className="mt-2 text-xs font-bold text-navy">
            {isId ? "Belum Ada Soal Kuis Tambahan" : "No Custom Quiz Questions Yet"}
          </h4>
          <p className="mt-1 text-[11px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            {isId
              ? "Anda dapat menambahkan soal pilihan ganda sendiri menggunakan tombol di atas. Jika dikosongkan, sistem LMS akan otomatis merumuskan 5 soal evaluasi pemahaman dari silabus Anda."
              : "You can add multiple-choice questions using the buttons above. If left blank, the LMS will automatically formulate 5 evaluation questions from your syllabus."}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white hover:bg-marine/90 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> {isId ? "Buat Soal Pertama" : "Create First Question"}
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      {questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div
              key={q.id ?? qIdx}
              className="rounded-xl border border-border bg-white p-4.5 shadow-2xs transition-all space-y-3"
            >
              {/* Question Header */}
              <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-marine text-xs font-bold text-white">
                    {qIdx + 1}
                  </span>
                  <span className="text-xs font-bold text-navy">
                    {isId ? `Butir Soal #${qIdx + 1}` : `Question #${qIdx + 1}`}
                  </span>
                  {q.question.trim().length > 0 &&
                  q.options.filter((o) => o.trim().length > 0).length >= 2 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> {isId ? "Siap" : "Ready"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <AlertCircle className="h-3 w-3" /> {isId ? "Belum Lengkap" : "Incomplete"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, "up")}
                    disabled={qIdx === 0}
                    className="p-1 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                    title={isId ? "Geser Naik" : "Move Up"}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIdx, "down")}
                    disabled={qIdx === questions.length - 1}
                    className="p-1 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                    title={isId ? "Geser Turun" : "Move Down"}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="p-1 rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive cursor-pointer ml-1"
                    title={isId ? "Hapus Soal" : "Delete Question"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Question Input */}
              <div>
                <label className="block text-[11px] font-bold text-navy uppercase tracking-wider mb-1">
                  {isId ? "Teks Pertanyaan / Soal" : "Question Text"}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={q.question}
                  onChange={(e) => handleUpdateQuestion(qIdx, { question: e.target.value })}
                  placeholder={
                    isId
                      ? "Contoh: Apa indikator utama kesehatan ekosistem terumbu karang yang diatur dalam pedoman BKSDA?"
                      : "e.g., What is the primary indicator of coral reef ecosystem health under national standards?"
                  }
                  className="w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground focus:border-marine focus:bg-white focus:outline-none min-h-[60px]"
                  required
                />
              </div>

              {/* Options Input (A, B, C, D) */}
              <div>
                <label className="block text-[11px] font-bold text-navy uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>
                    {isId ? "Pilihan Jawaban & Kunci Jawaban" : "Options & Correct Answer"}
                    <span className="text-destructive ml-0.5">*</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {isId
                      ? "Klik tombol centang hijau pada opsi yang merupakan kunci jawaban benar"
                      : "Click the green badge on the option that is the correct answer"}
                  </span>
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isKey = q.correctAnswer === optIdx;

                    return (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                          isKey
                            ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/30"
                            : "border-border bg-card hover:border-marine/30"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleUpdateQuestion(qIdx, { correctAnswer: optIdx })}
                          className={`flex items-center gap-1 shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                            isKey
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-800"
                          }`}
                          title={isId ? `Pilih opsi ${letter} sebagai kunci jawaban` : `Set option ${letter} as answer key`}
                        >
                          {isKey ? <CheckCircle2 className="h-3.5 w-3.5" /> : letter}
                          <span>{letter}</span>
                          {isKey && <span className="text-[9px] uppercase font-bold ml-0.5">[KUNCI]</span>}
                        </button>

                        <input
                          type="text"
                          value={q.options[optIdx] ?? ""}
                          onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                          placeholder={
                            isId ? `Isi pilihan jawaban ${letter}...` : `Answer option ${letter}...`
                          }
                          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                          required
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  {isId
                    ? "Pembahasan / Penjelasan Jawaban (Opsional - Muncul saat peserta meninjau hasil kuis)"
                    : "Answer Explanation (Optional - Shown to learner after quiz submission)"}
                </label>
                <input
                  type="text"
                  value={q.explanation || ""}
                  onChange={(e) => handleUpdateQuestion(qIdx, { explanation: e.target.value })}
                  placeholder={
                    isId
                      ? "Contoh: Penutupan karang hidup minimal 50% menjadi batas ambang kategori baik."
                      : "e.g., Live coral cover above 50% is the official threshold for good category."
                  }
                  className="w-full rounded-lg border border-border/80 bg-muted/20 px-3 py-1.5 text-xs text-foreground focus:border-marine focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Paste Modal */}
      {isBulkPasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-marine/10 text-marine">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-sm font-bold text-navy">
                    {isId ? "Tempel Cepat dari Naskah / Dokumen" : "Quick Bulk Question Import"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isId
                      ? "Salin draft soal dari dokumen Word/Catatan dan tempelkan di bawah ini."
                      : "Copy questions from Word or notes and paste them below."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {bulkError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5 text-[11px] font-semibold text-muted-foreground">
                <span>{isId ? "Format yang didukung:" : "Supported format:"}</span>
                <span className="font-mono text-[10px] text-marine">
                  1. Soal | A. ... B. ... | Kunci: A
                </span>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`1. Apa tujuan penetapan kawasan konservasi laut?
A. Melindungi keanekaragaman hayati dan habitat perikanan
B. Meningkatkan kuota penangkapan ikan komersial tanpa batas
C. Membuka seluruh perairan untuk industri pertambangan
D. Menghapus peraturan zonasi nelayan tradisional
Kunci: A
Pembahasan: Konservasi ditujukan untuk perlindungan habitat dan stok ikan berkelanjutan.

2. Berapa batas passing grade resmi pelatihan ini?
A. 50%
B. 70%
C. 90%
D. 100%
Kunci: B`}
                className="w-full h-64 rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs text-foreground focus:border-marine focus:bg-white focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="rounded-xl border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                {isId ? "Batal" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleProcessBulkPaste}
                className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-xs font-bold text-white hover:bg-marine/90 transition shadow-xs cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isId ? "Proses & Masukkan Soal" : "Parse & Insert Questions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

