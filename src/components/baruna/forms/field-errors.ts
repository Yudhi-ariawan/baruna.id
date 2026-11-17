// Helpers for the field-level form errors (FieldError.tsx). Kept apart from the
// components so React fast refresh keeps working.

/** Red border for a field that needs fixing (Tailwind v4 important suffix). */
export const fieldErrorCls = (msg?: string) => (msg ? " border-red-400! bg-red-50/40" : "");

/**
 * Scroll to the field marked data-field={key} and focus it. The mark may sit on the
 * input itself or on a wrapper; then the first input/select/textarea/button inside
 * gets the focus.
 */
export function focusField(key: string) {
  const el = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = el.matches("input,select,textarea,button")
    ? el
    : el.querySelector<HTMLElement>("input,select,textarea,button");
  (target ?? el).focus({ preventScroll: true });
}
