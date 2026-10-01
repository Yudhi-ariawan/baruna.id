import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
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

interface CountrySelectProps {
  value: string;
  onChange: (countryName: string, item: CountryItem) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isId?: boolean;
}

export function CountrySelect({
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
  isId = false,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);

  const selectedCountry = useMemo(() => {
    return getCountryByName(value);
  }, [value]);

  const defaultPlaceholder = isId ? "Pilih negara..." : "Select country...";
  const searchPlaceholder = isId ? "Cari nama negara..." : "Search country...";
  const emptyText = isId ? "Negara tidak ditemukan." : "No country found.";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-marine focus:ring-1 focus:ring-marine disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer text-left",
            className
          )}
        >
          {selectedCountry ? (
            <span className="flex items-center gap-2 truncate">
              <span className="text-base leading-none">{selectedCountry.flag}</span>
              <span className="font-medium text-foreground">{selectedCountry.name}</span>
              <span className="text-xs text-muted-foreground">({selectedCountry.code})</span>
            </span>
          ) : value ? (
            <span className="flex items-center gap-2 truncate">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{value}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder || defaultPlaceholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] sm:w-[380px] p-0 shadow-lg border-border" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => {
                const isSelected =
                  selectedCountry?.code === c.code ||
                  value?.trim().toLowerCase() === c.name.toLowerCase();
                return (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.code} ${c.dialCode}`}
                    onSelect={() => {
                      onChange(c.name, c);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted"
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">({c.dialCode})</span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-marine shrink-0" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

