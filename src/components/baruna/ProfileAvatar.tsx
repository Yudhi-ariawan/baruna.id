import { useEffect, useState } from "react";

export function ProfileAvatar({
  name,
  url,
  size = "small",
}: {
  name: string;
  url: string | null;
  size?: "small" | "large";
}) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(url));
  useEffect(() => setImageAvailable(Boolean(url)), [url]);

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const dimensions = size === "large" ? "h-16 w-16 text-lg" : "h-9 w-9 text-xs";

  if (url && imageAvailable) {
    return (
      <img
        src={url}
        alt={name}
        width={size === "large" ? 64 : 36}
        height={size === "large" ? 64 : 36}
        onError={() => setImageAvailable(false)}
        className={`${dimensions} shrink-0 rounded-full object-cover ring-2 ${
          size === "large" ? "ring-white/30" : "ring-marine/30"
        }`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`grid ${dimensions} shrink-0 place-items-center rounded-full font-display font-bold ring-2 ${
        size === "large"
          ? "bg-white/15 text-white ring-white/30"
          : "bg-marine/10 text-marine ring-marine/30"
      }`}
    >
      {initials || "B"}
    </span>
  );
}
