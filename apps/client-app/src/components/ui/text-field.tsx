import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    {
      id,
      label,
      description,
      error,
      containerClassName,
      className,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...inputProps
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy =
      [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") ||
      undefined;

    return (
      <Field
        data-invalid={error ? true : undefined}
        className={containerClassName}
      >
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        <Input
          ref={ref}
          id={inputId}
          className={className}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          {...inputProps}
        />
        {description ? (
          <FieldDescription id={descriptionId}>{description}</FieldDescription>
        ) : null}
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </Field>
    );
  },
);
