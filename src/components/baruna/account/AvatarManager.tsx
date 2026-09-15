import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setAccountAvatar } from "@/lib/account/account.functions";
import { AVATAR_BUCKET, AVATAR_PRESETS } from "@/lib/account/account.types";
import { ProfileAvatar } from "../ProfileAvatar";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function AvatarManager({
  userId,
  displayName,
  avatarUrl,
  onAvatarChange,
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  onAvatarChange: (avatarUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const saveAvatar = useServerFn(setAccountAvatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const publicUrl = (path: string) =>
    supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;

  async function applyAvatar(objectPath: string | null): Promise<boolean> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveAvatar({ data: { objectPath } });
      onAvatarChange(result.avatarUrl);
      await queryClient.invalidateQueries({ queryKey: ["home", "viewer"] });
      setMessage(objectPath ? "Your avatar has been updated." : "Your avatar has been removed.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update your avatar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | null) {
    if (!file) return;
    if (!allowedTypes.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Avatar files must be 2 MB or smaller.");
      return;
    }
    const objectPath = `users/${userId}/${crypto.randomUUID()}.${extensionByType[file.type]}`;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, file, {
        contentType: file.type,
        upsert: false,
      });
    setBusy(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const applied = await applyAvatar(objectPath);
    if (!applied) {
      await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ProfileAvatar name={displayName} url={avatarUrl} size="large" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-navy">Profile Avatar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a photo or choose a BARUNA maritime illustration. Avatars are publicly visible.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void upload(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white hover:bg-navy disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload Photo
            </button>
            <button
              type="button"
              disabled={busy || !avatarUrl}
              onClick={() => void applyAvatar(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-navy hover:bg-muted disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">JPEG, PNG, or WebP. Maximum 2 MB.</p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy">
          <ImagePlus className="h-4 w-4 text-marine" /> Choose a preset
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AVATAR_PRESETS.map((preset) => {
            const url = publicUrl(preset.path);
            const selected = avatarUrl === url;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() => void applyAvatar(preset.path)}
                className={`rounded-xl border p-2 text-left transition hover:border-marine ${selected ? "border-marine bg-marine/5 ring-2 ring-marine/20" : "border-border"}`}
              >
                <img
                  src={url}
                  alt={preset.label}
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <span className="mt-2 block truncate text-xs font-semibold text-navy">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}
