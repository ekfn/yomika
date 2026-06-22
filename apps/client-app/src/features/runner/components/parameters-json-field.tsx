import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldTitle } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ParametersJsonFieldProps = {
  disabled: boolean;
  label: React.ReactNode;
  value: string;
  placeholder: string;
  emptyLabel: string;
  className?: string;
  onChange: (value: string) => void;
};

export function ParametersJsonField({
  disabled,
  label,
  value,
  placeholder,
  emptyLabel,
  className,
  onChange,
}: ParametersJsonFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const trimmedValue = value.trim();
  const ariaLabel = typeof label === "string" ? label : "Parameters JSON";

  return (
    <Field className={className}>
      <FieldTitle>{label}</FieldTitle>

      {isEditing ? (
        <>
          <Textarea
            value={value}
            aria-label={ariaLabel}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            placeholder={placeholder}
            disabled={disabled}
            spellCheck={false}
            className="min-h-24 font-mono text-sm"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsEditing(false);
              }}
            >
              Done
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={cn(
            "flex min-h-8 w-full items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => {
            setIsEditing(true);
          }}
        >
          <code
            className={cn(
              "min-w-0 flex-1 truncate font-mono text-xs",
              !trimmedValue && "font-sans text-muted-foreground",
            )}
          >
            {trimmedValue || emptyLabel}
          </code>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </Field>
  );
}
