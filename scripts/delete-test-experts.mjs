import { createClient } from "@supabase/supabase-js";

/**
 * Script Pembersihan Aman Data Uji (Safe Test Data Purge)
 * Sesuai Standar Ketergantungan Relasi BARUNA (ENGINEERING_STANDARDS.md)
 *
 * Penggunaan:
 *   node scripts/delete-test-experts.mjs --email <email-uji>
 *   node scripts/delete-test-experts.mjs --subject-id <subject-uuid>
 *   node scripts/delete-test-experts.mjs --list-test
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diset di environment variables.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf("--email");
  const subjectIdx = args.indexOf("--subject-id");
  const isList = args.includes("--list-test");

  if (isList) {
    console.log("🔍 Mencari data pengajuan berindikasi uji coba...");
    const { data: subjects, error } = await admin
      .from("review_subjects")
      .select("id, title, current_status, created_at, metadata")
      .eq("kind", "expert")
      .or("title.ilike.%test%,title.ilike.%uji%,title.ilike.%demo%");

    if (error) {
      console.error("Gagal mengambil data:", error.message);
      return;
    }

    if (!subjects || subjects.length === 0) {
      console.log("ℹ️ Tidak ditemukan data uji coba dengan kata kunci test/uji/demo.");
      return;
    }

    console.log(`Ditemukan ${subjects.length} data pengajuan uji coba:`);
    subjects.forEach((s, idx) => {
      console.log(`  ${idx + 1}. [${s.id}] "${s.title}" (Status: ${s.current_status}) - Dibuat: ${s.created_at}`);
    });
    return;
  }

  let targetSubjectId = null;

  if (subjectIdx !== -1 && args[subjectIdx + 1]) {
    targetSubjectId = args[subjectIdx + 1];
  } else if (emailIdx !== -1 && args[emailIdx + 1]) {
    const targetEmail = args[emailIdx + 1];
    console.log(`🔍 Mencari pengajuan pakar dengan email draft: ${targetEmail}...`);
    const { data: drafts } = await admin
      .from("review_drafts")
      .select("linked_subject_id, payload")
      .limit(100);

    const found = drafts?.find((d) => {
      const p = d.payload || {};
      return typeof p.email === "string" && p.email.toLowerCase() === targetEmail.toLowerCase();
    });

    if (found?.linked_subject_id) {
      targetSubjectId = found.linked_subject_id;
    } else {
      console.error(`❌ Tidak ditemukan pengajuan expert dengan email: ${targetEmail}`);
      process.exit(1);
    }
  } else {
    console.log("Panduan Penggunaan:");
    console.log("  node scripts/delete-test-experts.mjs --list-test");
    console.log("  node scripts/delete-test-experts.mjs --email <email-uji>");
    console.log("  node scripts/delete-test-experts.mjs --subject-id <uuid>");
    process.exit(0);
  }

  console.log(`🚀 Memulai pembersihan aman untuk Subject ID: ${targetSubjectId}`);

  // 1. Ambil relasi experts jika sudah dipublikasikan
  const { data: expert } = await admin
    .from("experts")
    .select("id, slug, display_name")
    .eq("source_submission_id", targetSubjectId)
    .maybeSingle();

  if (expert) {
    console.log(`   Menghapus relasi profil pakar: ${expert.display_name} (${expert.id})`);
    await admin.from("expert_trainer_status").delete().eq("expert_id", expert.id);
    await admin.from("expert_availability").delete().eq("expert_id", expert.id);
    await admin.from("expert_employment").delete().eq("expert_id", expert.id);
    await admin.from("expert_education").delete().eq("expert_id", expert.id);
    await admin.from("expert_skills").delete().eq("expert_id", expert.id);
    await admin.from("experts").delete().eq("id", expert.id);
  }

  // 2. Hapus data review, draft, dan revisi
  console.log(`   Menghapus keputusan, catatan review, dan draf pengajuan...`);
  await admin.from("review_decisions").delete().eq("subject_id", targetSubjectId);
  await admin.from("review_records").delete().eq("subject_id", targetSubjectId);
  await admin.from("review_assignments").delete().eq("subject_id", targetSubjectId);
  await admin.from("review_drafts").delete().eq("linked_subject_id", targetSubjectId);
  await admin.from("review_subject_revisions").delete().eq("subject_id", targetSubjectId);
  await admin.from("review_subjects").delete().eq("id", targetSubjectId);

  // 3. Catat audit pembersihan
  await admin.from("governance_audit_log").insert({
    event_type: "test_data_purged",
    entity_type: "review_subject",
    entity_id: targetSubjectId,
    after: {
      purged_at: new Date().toISOString(),
      purged_by: "system_cli_script",
    },
  });

  console.log(`✅ Sukses! Data uji ${targetSubjectId} telah dibersihkan tuntas tanpa merusak data lainnya.`);
}

main().catch((err) => {
  console.error("❌ Terjadi kesalahan saat pembersihan:", err);
  process.exit(1);
});

