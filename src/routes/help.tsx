import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, MessageSquare, BookOpen, Mail } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & Support — BARUNA" }, { name: "description", content: "Get help using BARUNA — FAQ, contact, and guides." }] }),
  component: HelpPage,
});

const FAQS_EN = [
  { q: "How do I enroll in a Self-Paced Course?", a: "Open a Self-Paced Course, then click Enroll. In Presentation Mode nothing is saved to a real store." },
  { q: "How do I become a BARUNA Trainer?", a: "Complete the Become a Trainer application under Experts. Approval is manual." },
  { q: "How is my certificate verified?", a: "Every certificate carries a verification code and QR link to a public verification page." },
  { q: "Is my data safe in Presentation Mode?", a: "Yes — Presentation Mode never writes to production storage." },
];

const FAQS_ID = [
  { q: "Bagaimana cara mendaftar di Kursus Mandiri?", a: "Buka Kursus Mandiri yang diinginkan, lalu klik Daftar. Pada Mode Presentasi tidak ada data yang disimpan permanen." },
  { q: "Bagaimana cara menjadi Trainer BARUNA?", a: "Lengkapi formulir pendaftaran Menjadi Trainer di menu Pakar. Persetujuan dilakukan secara manual oleh tim kurator." },
  { q: "Bagaimana sertifikat saya diverifikasi?", a: "Setiap sertifikat memiliki kode verifikasi unik dan tautan QR ke halaman verifikasi publik yang sah." },
  { q: "Apakah data saya aman dalam Mode Presentasi?", a: "Ya — Mode Presentasi tidak pernah menulis ke basis data produksi." },
];

function HelpPage() {
  const { language } = useLanguage();
  const isId = language === "id";
  const faqs = isId ? FAQS_ID : FAQS_EN;

  return (
    <PageShell
      sidebar={{ icon: HelpCircle, title: isId ? "Bantuan & Dukungan" : "Help & Support", subtitle: isId ? "Jawaban, panduan, dan kontak." : "Answers, guides, and contact.", sections: [{ label: isId ? "Bagian" : "Sections", items: [
        { label: "FAQ", active: true }, { label: isId ? "Tentang BARUNA" : "About BARUNA", to: "/about" }, { label: isId ? "Kontak" : "Contact", to: "/help#contact" },
      ] }] }}
      cta={{ icon: Mail, title: isId ? "Masih butuh bantuan?" : "Still stuck?", description: isId ? "Hubungi tim dukungan BARUNA." : "Contact the BARUNA support team.", button: isId ? "Email Dukungan" : "Email Support", href: "/help#contact" }}
    >
      <h1 className="font-display text-3xl font-extrabold text-navy">
        {isId ? "Bantuan & Dukungan" : "Help & Support"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isId ? "Semua yang Anda butuhkan untuk menggunakan platform BARUNA." : "Everything you need to use the BARUNA demo."}
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link to="/about" className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-marine/50">
          <BookOpen className="h-6 w-6 text-marine" />
          <p className="mt-2 font-bold text-navy">{isId ? "Panduan pengguna" : "User guides"}</p>
          <p className="text-xs text-muted-foreground">
            {isId ? "Cara kerja BARUNA dan navigasi fitur." : "How BARUNA works and how to navigate."}
          </p>
        </Link>
        <Link to="/community" className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-marine/50">
          <MessageSquare className="h-6 w-6 text-marine" />
          <p className="mt-2 font-bold text-navy">{isId ? "Tanya komunitas" : "Ask the community"}</p>
          <p className="text-xs text-muted-foreground">
            {isId ? "Ajukan pertanyaan di Komunitas Praktik." : "Post questions to the Communities of Practice."}
          </p>
        </Link>
        <a href="mailto:hello@example.com" id="contact" className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:border-marine/50">
          <Mail className="h-6 w-6 text-marine" />
          <p className="mt-2 font-bold text-navy">{isId ? "Hubungi dukungan" : "Contact support"}</p>
          <p className="text-xs text-muted-foreground">hello@example.com — {isId ? "alamat email resmi" : "synthetic demo address"}.</p>
        </a>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-navy">
          {isId ? "Pertanyaan yang sering diajukan" : "Frequently asked questions"}
        </h2>
        <dl className="mt-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-bold text-navy">{f.q}</dt>
              <dd className="mt-1 text-sm text-foreground/80">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PageShell>
  );
}
