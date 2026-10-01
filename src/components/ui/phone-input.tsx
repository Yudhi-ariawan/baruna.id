import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Phone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COUNTRIES, getCountryByName, type CountryItem } from "@/lib/geo/countries";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (fullPhone: string) => void;
  countryName?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isId?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  countryName = "Indonesia",
  placeholder,
  className,
  disabled = false,
  isId = false,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);

  // Determine initial dial code based on countryName or existing value
  const initialCountry = useMemo(() => {
    if (value && value.startsWith("+")) {
      const match = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (match) return match;
    }
    return getCountryByName(countryName) || COUNTRIES[0];
  }, [countryName, value]);

  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(initialCountry);

  // Extract national number from value
  const nationalNumber = useMemo(() => {
    if (!value) return "";
    if (value.startsWith(selectedCountry.dialCode)) {
      return value.slice(selectedCountry.dialCode.length).trim();
    }
    if (value.startsWith("+")) {
      const matched = COUNTRIES.find((c) => value.startsWith(c.dialCode));
      if (matched) {
        return value.slice(matched.dialCode.length).trim();
      }
    }
    // If starts with 0 (e.g. 0812...), remove leading 0 for international format
    if (value.startsWith("0")) {
      return value.slice(1).trim();
    }
    return value;
  }, [value, selectedCountry]);

  // Sync when countryName prop changes from outside (e.g. user changes Country select)
  useEffect(() => {
    if (countryName) {
      const found = getCountryByName(countryName);
      if (found && found.code !== selectedCountry.code) {
        setSelectedCountry(found);
        if (nationalNumber) {
          onChange(`${found.dialCode} ${nationalNumber}`);
        }
      }
    }
  }, [countryName]);

  const handleCountryChange = (c: CountryItem) => {
    setSelectedCountry(c);
    setOpen(false);
    if (nationalNumber) {
      onChange(`${c.dialCode} ${nationalNumber}`);
    } else {
      onChange(c.dialCode);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, spaces, and hyphens only
    const cleanDigits = raw.replace(/[^\d\s-]/g, "");
    
    // If user pastes a full international number like +62812...
    if (raw.startsWith("+")) {
      const matched = COUNTRIES.find((c) => raw.startsWith(c.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        const rest = raw.slice(matched.dialCode.length).trim();
        onChange(`${matched.dialCode} ${rest}`);
        return;
      }
    }

    // Strip leading 0 if entered
    let formattedNumber = cleanDigits;
    if (formattedNumber.startsWith("0")) {
      formattedNumber = formattedNumber.slice(1);
    }

    if (!formattedNumber.trim()) {
      onChange("");
    } else {
      onChange(`${selectedCountry.dialCode} ${formattedNumber}`);
    }
  };

  const defaultPlaceholder = isId ? "812 3456 7890" : "812 3456 7890";

  return (
    <div className={cn("flex items-center rounded-lg border border-border bg-background transition-colors focus-within:border-marine focus-within:ring-1 focus-within:ring-marine overflow-hidden", className)}>
      {/* Country Dial Code Trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1.5 border-r border-border bg-muted/30 px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/70 transition-colors shrink-0 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="font-mono">{selectedCountry.dialCode}</span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] sm:w-[340px] p-0 shadow-lg border-border" align="start">
          <Command>
            <CommandInput placeholder={isId ? "Cari kode negara..." : "Search dial code..."} />
            <CommandList className="max-h-56 overflow-y-auto">
              <CommandEmpty>{isId ? "Tidak ditemukan." : "No country found."}</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => {
                  const isSelected = selectedCountry.code === c.code;
                  return (
                    <CommandItem
                      key={c.code}
                      value={`${c.name} ${c.code} ${c.dialCode}`}
                      onSelect={() => handleCountryChange(c)}
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-base leading-none">{c.flag}</span>
                        <span className="font-medium text-xs text-foreground">{c.name}</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-marine shrink-0 ml-2">
                        {c.dialCode}
                      </span>
                    </CommandItem>
                  );
                })}
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
          value={nationalNumber}
          onChange={handleNumberChange}
          placeholder={placeholder || defaultPlaceholder}
          className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed font-mono tracking-wide"
        />
      </div>
    </div>
  );
}

