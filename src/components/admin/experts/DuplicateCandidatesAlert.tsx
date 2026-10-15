import { AlertTriangle } from "lucide-react";
import type { AdminExpertDetail } from "@/lib/admin/experts.functions";

/**
 * Slide 37 Duplicate/Match: warns the reviewer when other directory profiles
 * share this applicant's name or email. Advisory only; the decision stays with
 * the approver (same person re-registering vs. a namesake).
 */
export function DuplicateCandidatesAlert({
  candidates,
}: {
  candidates: AdminExpertDetail["possibleDuplicates"];
}) {
  if (!candidates.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-900">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Kemungkinan duplikat: {candidates.length} profil lain di direktori mirip dengan pemohon ini
      </p>
      <ul className="mt-2 space-y-1 pl-6 list-disc">
        {candidates.map((c) => (
          <li key={c.expertId}>
            {c.slug ? (
              <a
                href={`/experts/${c.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                {c.displayName}
              </a>
            ) : (
              <span className="font-semibold">{c.displayName}</span>
            )}{" "}
            ({c.matchReason}, status: {c.status})
          </li>
        ))}
      </ul>
      <p className="mt-2">
        Periksa apakah ini orang yang sama sebelum menyetujui. Jika sama, minta revisi atau tolak
        agar direktori tidak berisi profil ganda.
      </p>
    </div>
  );
}
