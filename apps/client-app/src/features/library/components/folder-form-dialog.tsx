import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@apollo/client/react";
import { FolderPlus } from "lucide-react";
import { CreateFolderDocument } from "@/graphql/generated/graphql";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { TextField } from "@/components/ui/text-field";
import { FolderLocationStrip, ROOT_FOLDER_LABEL } from "./folder-location-info";

type FolderFormDialogProps = {
  parentPath?: string | null;
  parentLabel?: string | null;
  open?: boolean;
  trigger?: ReactNode | null;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: () => Promise<void> | void;
};

type FolderFormErrors = {
  name?: string | undefined;
};

type FolderFormContentProps = {
  parentPath: string | null | undefined;
  parentLabel: string | null | undefined;
  onClose: () => void;
  onCompleted: (() => Promise<void> | void) | undefined;
};

export function FolderFormDialog({
  parentPath,
  parentLabel,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: FolderFormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  function handleOpenChange(nextOpen: boolean) {
    setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="default">
              <FolderPlus />
              New Folder
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <FolderFormContent
            parentPath={parentPath}
            parentLabel={parentLabel}
            onClose={() => handleOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FolderFormContent({
  parentPath,
  parentLabel,
  onClose,
  onCompleted,
}: FolderFormContentProps) {
  const [name, setName] = useState("");
  const [formErrors, setFormErrors] = useState<FolderFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createFolder, createState] = useMutation(CreateFolderDocument);
  const saving = createState.loading;
  const locationLabel = parentLabel ?? ROOT_FOLDER_LABEL;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const nextFormErrors = validateFolderForm({ name });

    if (hasFormErrors(nextFormErrors)) {
      setFormErrors(nextFormErrors);
      return;
    }

    setFormErrors({});

    try {
      await createFolder({
        variables: {
          input: {
            name,
            parentPath: parentPath ?? null,
          },
        },
      });

      await onCompleted?.();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b px-4 py-4 pr-12">
        <DialogTitle>New Folder</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        <FieldGroup className="gap-4">
          <TextField
            id="folder-name"
            label="Name"
            error={formErrors.name}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setFormErrors((currentFormErrors) => ({
                ...currentFormErrors,
                name: undefined,
              }));
            }}
          />
        </FieldGroup>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="flex-col gap-3 sm:items-center sm:justify-between">
          <FolderLocationStrip value={locationLabel} />
          <Button type="submit" disabled={saving}>
            {saving ? "Saving" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function validateFolderForm(input: { name: string }): FolderFormErrors {
  const errors: FolderFormErrors = {};

  if (!input.name.trim()) {
    errors.name = "Name is required.";
  }

  return errors;
}

function hasFormErrors(errors: FolderFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}
