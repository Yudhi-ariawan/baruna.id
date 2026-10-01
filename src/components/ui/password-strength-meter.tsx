import { Check, X } from "lucide-react";
import { useMemo } from "react";

export interface PasswordRule {
  id: string;
  label: string;
  labelEn: string;
  isValid: boolean;
}

export interface PasswordStrengthMeterProps {
  password: string;
  isId?: boolean;
  className?: string;
  showRules?: boolean;
}

export function PasswordStrengthMeter({
  password,
  isId = true,
  className = "",
  showRules = true,
}: PasswordStrengthMeterProps) {
  const rules: PasswordRule[] = useMemo(() => {
    return [
      {
        id: "length",
        label: "Minimal 8 karakter",
        labelEn: "At least 8 characters",
        isValid: password.length >= 8,
      },
      {
        id: "mixed",
        label: "Kombinasi huruf besar & kecil",
        labelEn: "Uppercase & lowercase letters",
        isValid: /[a-z]/.test(password) && /[A-Z]/.test(password),
      },
      {
        id: "number",
        label: "Mengandung minimal 1 angka",
        labelEn: "At least 1 number",
        isValid: /\d/.test(password),
      },
      {
        id: "special",
        label: "Mengandung simbol khusus (@, #, $, dll)",
        labelEn: "At least 1 special character (@, #, $, etc)",
        isValid: /[^A-Za-z0-9]/.test(password),
      },
    ];
  }, [password]);

  const passedCount = useMemo(() => rules.filter((r) => r.isValid).length, [rules]);

  const strength = useMemo(() => {
    if (!password) return { score: 0, label: isId ? "Belum diisi" : "Empty", color: "bg-slate-200", textColor: "text-slate-400" };
    if (passedCount <= 1) return { score: 1, label: isId ? "Sangat Lemah" : "Very Weak", color: "bg-red-500", textColor: "text-red-600" };
    if (passedCount === 2) return { score: 2, label: isId ? "Lemah" : "Weak", color: "bg-amber-500", textColor: "text-amber-600" };
    if (passedCount === 3) return { score: 3, label: isId ? "Sedang" : "Moderate", color: "bg-yellow-500", textColor: "text-yellow-600" };
    return { score: 4, label: isId ? "Sangat Kuat" : "Very Strong", color: "bg-emerald-500", textColor: "text-emerald-600" };
  }, [password, passedCount, isId]);

  if (!password && !showRules) return null;

  return (
    <div className={`space-y-2.5 pt-1 ${className}`}>
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium text-muted-foreground">
            {isId ? "Kekuatan Kata Sandi:" : "Password Strength:"}
          </span>
          <span className={`text-[11px] font-bold ${strength.textColor}`}>
            {strength.label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`h-full rounded-full transition-all duration-300 ${
                level <= strength.score ? strength.color : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Rules Checklist */}
      {showRules && (
        <ul className="space-y-1.5 pt-1">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                rule.isValid ? "text-emerald-700 font-medium" : "text-muted-foreground"
              }`}
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full transition-all duration-200 ${
                  rule.isValid
                    ? "bg-emerald-100 text-emerald-600 ring-1 ring-emerald-300"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {rule.isValid ? (
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                ) : (
                  <X className="h-2.5 w-2.5 stroke-[2]" />
                )}
              </span>
              <span className="text-[11px] leading-tight">
                {isId ? rule.label : rule.labelEn}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

