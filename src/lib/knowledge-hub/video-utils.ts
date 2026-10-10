/**
 * Utilities for detecting, parsing, and embedding Video / Multimedia resources
 * in the BARUNA Knowledge Hub (YouTube, Vimeo, and direct MP4/WebM/Audio files).
 */

const VIDEO_RESOURCE_TYPES = new Set([
  "Video",
  "Webinar Recording",
  "Podcast",
  "video",
  "webinar_recording",
  "podcast",
  "videos",
]);

export function isVideoResourceType(type?: string | null): boolean {
  if (!type) return false;
  return VIDEO_RESOURCE_TYPES.has(type.trim());
}

/**
 * Extracts an 11-character YouTube video ID from standard watch, short, embed, shorts, or live URLs.
 */
export function extractYouTubeVideoId(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const vParam = parsed.searchParams.get("v");
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (
        segments.length >= 2 &&
        ["embed", "shorts", "live", "v"].includes(segments[0]) &&
        /^[a-zA-Z0-9_-]{11}$/.test(segments[1])
      ) {
        return segments[1];
      }
    }
  } catch {
    // Fallback regex if URL constructor fails
    const match = trimmed.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    );
    return match?.[1] ?? null;
  }

  return null;
}

/**
 * Extracts a numeric Vimeo video ID from vimeo.com or player.vimeo.com URLs.
 */
export function extractVimeoVideoId(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d{6,12})/i);
  return match?.[1] ?? null;
}

/**
 * Returns an iframe-compatible embed URL for YouTube or Vimeo links, or null if not supported.
 */
export function getVideoEmbedUrl(url?: string | null, autoplay = false): string | null {
  const ytId = extractYouTubeVideoId(url);
  if (ytId) {
    const params = new URLSearchParams({ rel: "0" });
    if (autoplay) params.set("autoplay", "1");
    return `https://www.youtube.com/embed/${ytId}?${params.toString()}`;
  }

  const vimeoId = extractVimeoVideoId(url);
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}${autoplay ? "?autoplay=1" : ""}`;
  }

  return null;
}

/**
 * Checks if a URL or filename points directly to a playable media file (.mp4, .webm, .mov, .mp3, .wav, .ogg, .m4a).
 */
export function isDirectMediaUrl(url?: string | null): "video" | "audio" | null {
  if (!url || typeof url !== "string") return null;
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(mp4|webm|mov)$/.test(clean)) return "video";
  if (/\.(mp3|wav|ogg|m4a)$/.test(clean)) return "audio";
  return null;
}

/**
 * Resolves a high-quality thumbnail URL from a YouTube link when no custom banner is uploaded.
 */
export function getYouTubeThumbnailUrl(url?: string | null): string | null {
  const ytId = extractYouTubeVideoId(url);
  if (!ytId) return null;
  return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
}

/**
 * Formats seconds (e.g. from HTMLMediaElement.duration) into MM:SS or HH:MM:SS.
 */
export function formatMediaDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const totalSec = Math.round(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
