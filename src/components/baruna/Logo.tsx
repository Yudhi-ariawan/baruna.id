import lockup from "@/assets/baruna-lockup.png";
import icon from "@/assets/baruna-icon.png";

const ALT =
  "BARUNA — Indonesia's Marine and Fisheries Knowledge & Capacity Building Network";

/**
 * Official BARUNA logo system. The uploaded brand asset is used directly and
 * never recreated, recolored, or restyled.
 *
 * - `variant="full"` (default): primary lockup (emblem + wordmark + subtitle).
 *   Use everywhere by default — headers, footer, landing, auth, all sections.
 * - `variant="icon"`: circular Garuda emblem only. Use ONLY for favicon,
 *   mobile collapsed menu, loading screens, and notification icons.
 */
export function Logo({
  className = "",
  variant = "full",
}: {
  className?: string;
  variant?: "full" | "icon";
}) {
  if (variant === "icon") {
    return (
      <img
        src={icon}
        alt={ALT}
        width={48}
        height={48}
        className={`h-11 w-11 shrink-0 object-contain ${className}`}
      />
    );
  }

  return (
    <img
      src={lockup}
      alt={ALT}
      width={1453}
      height={288}
      className={`h-14 w-auto object-contain sm:h-16 ${className}`}
    />
  );
}
