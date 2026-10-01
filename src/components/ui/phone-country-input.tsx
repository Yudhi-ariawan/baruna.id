import { useState, useMemo, useEffect } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COUNTRIES, type CountryItem } from "@/lib/geo/countries";
import { cn } from "@/lib/utils";

export interface PhoneCountryInputProps {
  value: string;
  onChange: (fullPhoneNumber: string) => void;
  defaultCountryCode?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isId?: boolean;
}

export function PhoneCountryInput({
  value,
  onChange,
  defaultCountryCode = "ID",
  placeholder,
  disabled = false,
  className = "",
  isId = true,
}: PhoneCountryInputProps) {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(() => {
    return (
      COUNTRIES.find((c) => c.code === defaultCountryCode) ||
      COUNTRIES[0] || { name: "Indonesia", code: "ID", dialCode: "+62", flag: "🇮🇩" }
    );
  });

  // Extract national number if value starts with dialCode
  const rawNumber = useMemo(() => {
    if (!value) return "";
    for (const c of COUNTRIES) {
      if (value.startsWith(c.dialCode)) {
        return value.slice(c.dialCode.length).trim();
      }
    }
    return value.replace(/^\+/, "").trim();
  }, [value]);

  const [numberInput, setNumberInput] = useState(rawNumber);

  useEffect(() => {
    setNumberInput(rawNumber);
  }, [rawNumber]);

  function handleCountrySelect(country: CountryItem) {
    setSelectedCountry(country);
    setOpen(false);
    const cleaned = numberInput.replace(/^0+/, "");
    const full = cleaned ? `${country.dialCode}${cleaned}` : "";
    onChange(full);
  }

  function handleNumberChange(val: string) {
    const cleanDigits = val.replace(/[^0-9\s-]/g, "");
    setNumberInput(cleanDigits);
    const withoutZero = cleanDigits.replace(/^0+/, "").replace(/[\s-]/g, "");
    const full = withoutZero ? `${selectedCountry.dialCode}${withoutZero}` : "";
    onChange(full);
  }

  return (
    <div className={cn("flex w-full items-center rounded-lg border border-border bg-background transition-colors focus-within:border-marine focus-within:ring-1 focus-within:ring-marine", className)}>
      {/* Country Dial Code Dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            className="flex items-center gap-1.5 border-r border-border/80 bg-slate-50/70 px-3 py-2.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-slate-100 transition rounded-l-lg disabled:opacity-60 cursor-pointer shrink-0"
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="text-xs font-bold text-navy">{selectedCountry.dialCode}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={isId ? "Cari kode / negara..." : "Search country / code..."} />
            <CommandList className="max-h-60 overflow-y-auto">
              <CommandEmpty>{isId ? "Negara tidak ditemukan." : "No country found."}</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.code} ${c.dialCode}`}
                    onSelect={() => handleCountrySelect(c)}
                    className="flex items-center justify-between text-xs py-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm">{c.flag}</span>
                      <span className="font-medium text-foreground truncate">{c.name}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground shrink-0 ml-2 font-semibold">
                      {c.dialCode}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Number Input */}
      <div className="relative flex-1">
        <input
          type="tel"
          disabled={disabled}
          value={numberInput}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder || (isId ? "812 3456 7890" : "812 3456 7890")}
          className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed text-foreground"
        />
      </div>
    </div>
  );
}

