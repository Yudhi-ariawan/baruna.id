import { Link } from "@tanstack/react-router";
import { X, GraduationCap, ExternalLink, Users, AlertCircle } from "lucide-react";
import type { MasterModule } from "@/data/masterModules";

export type AccessModalProps = {
  open: boolean;
  onClose: () => void;
  master: MasterModule | undefined;
  moduleTitle: string;
};

/**
 * Notification modal shown when a public visitor or non-enrolled learner
 * clicks a gated action on a Knowledge Hub module (Start Module, Access Full
 * Module, Open Learning Materials, Download Module, Take Assessment).
 *
 * The spec forbids generic "Access Denied" copy — this modal explains the
 * learning pathway and offers three connected next steps.
 */
export function AccessNotificationModal({ open, onClose, master, moduleTitle }: AccessModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-hover"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h2 id="access-modal-title" className="font-display text-base font-extrabold text-navy">
                Access This Module Through a Self-Paced Course
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{moduleTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5 text-sm leading-relaxed text-foreground/85">
          <p>
            This learning module is available through a BARUNA Self-Paced Course. Join the related Self-Paced
            Course to access the complete learning materials, learning activities, assessment, and
            Certificate of Completion.
          </p>
          <p className="rounded-xl border border-marine/30 bg-marine/5 p-3 text-xs text-navy">
            This module is also included in the{" "}
            <strong className="font-bold">International Training on Fisheries for African Countries</strong>.
          </p>
          {!master && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Self-Paced Course link is not available for this module yet.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border bg-muted/40 p-4 sm:flex-row sm:flex-wrap">
          {master && (
            <>
              <Link
                to="/academy/self-paced/$code"
                params={{ code: master.code }}
                onClick={onClose}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-marine px-4 py-2.5 text-sm font-semibold text-marine-foreground hover:bg-marine/90"
              >
                <GraduationCap className="h-4 w-4" /> Join the Self-Paced Course
              </Link>
              <Link
                to="/academy/self-paced/$code"
                params={{ code: master.code }}
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-marine/40 bg-card px-4 py-2.5 text-sm font-semibold text-marine hover:border-marine"
              >
                <ExternalLink className="h-4 w-4" /> View Self-Paced Course Details
              </Link>
            </>
          )}
          <Link
            to="/academy/training/$slug"
            params={{ slug: "international-training-fisheries-african-countries" }}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy hover:border-marine/40"
          >
            <Users className="h-4 w-4" /> View Full Training Program
          </Link>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-navy"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
