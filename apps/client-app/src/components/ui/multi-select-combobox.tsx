import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type MultiSelectComboboxOption<TValue extends string = string> = {
  value: TValue;
  label: string;
};

type MultiSelectComboboxProps<TValue extends string = string> = {
  options: readonly MultiSelectComboboxOption<TValue>[];
  value: readonly TValue[];
  onValueChange: (value: TValue[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function MultiSelectCombobox<TValue extends string = string>({
  options,
  value,
  onValueChange,
  placeholder = "Select options",
  searchPlaceholder = "Search options...",
  emptyText = "No options found.",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: MultiSelectComboboxProps<TValue>) {
  const selectedValueSet = React.useMemo(() => new Set(value), [value]);
  const selectedOptions = React.useMemo(
    () => options.filter((option) => selectedValueSet.has(option.value)),
    [options, selectedValueSet],
  );

  return (
    <Combobox
      items={options}
      itemToStringValue={(option) => option.label}
      multiple
      disabled={disabled}
      value={selectedOptions}
      onValueChange={(nextOptions) => {
        onValueChange(nextOptions.map((option) => option.value));
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={ariaLabel}
            className={cn(
              "h-auto min-h-8 w-full justify-between gap-2 py-1.5 whitespace-normal hover:border-ring hover:bg-background aria-expanded:border-ring aria-expanded:bg-background dark:hover:bg-input/30 dark:aria-expanded:bg-input/30",
              className,
            )}
          />
        }
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <Badge key={option.value} variant="secondary">
                {option.label}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
      </ComboboxTrigger>
      <ComboboxContent align="start">
        <ComboboxInput
          placeholder={searchPlaceholder}
          showTrigger={false}
          showClear
        />
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(option: MultiSelectComboboxOption<TValue>) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
