import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@apollo/client/react";
import { getPageDisplayName } from "@yomika/shared";
import {
  type PageListFieldsFragment,
  type PageQuery,
  UpdatePageDocument,
} from "@/graphql/generated/graphql";
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

type PageRenameDialogPage = Pick<
  NonNullable<PageQuery["page"]> | PageListFieldsFragment,
  "path" | "bookPath"
>;

type PageRenameDialogProps = {
  page: PageRenameDialogPage;
  open?: boolean;
  trigger?: ReactNode | null;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (path?: string) => Promise<void> | void;
};

export function PageRenameDialog({
  page,
  open: controlledOpen,
  trigger,
  onOpenChange,
  onCompleted,
}: PageRenameDialogProps) {
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
          {trigger ?? <Button>Rename</Button>}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <PageRenameContent
            page={page}
            onClose={() => handleOpenChange(false)}
            onCompleted={onCompleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PageRenameContent({
  page,
  onClose,
  onCompleted,
}: {
  page: PageRenameDialogPage;
  onClose: () => void;
  onCompleted: PageRenameDialogProps["onCompleted"];
}) {
  const [name, setName] = useState(getPageDisplayName(page.path));
  const [nameError, setNameError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatePage, updateState] = useMutation(UpdatePageDocument);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (page.bookPath) {
      setErrorMessage("Book pages cannot be renamed separately.");
      return;
    }

    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }

    setNameError(undefined);

    try {
      const result = await updatePage({
        variables: {
          path: page.path,
          input: {
            name,
          },
        },
      });

      await onCompleted?.(result.data?.updatePage.path);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <DialogHeader className="-mx-4 -mt-4 rounded-t-xl border-b px-4 py-4 pr-12">
        <DialogTitle>Rename Page</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
        <FieldGroup className="gap-4">
          <TextField
            id="page-rename-name"
            label="Name"
            error={nameError}
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setNameError(undefined);
            }}
          />
        </FieldGroup>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="submit" disabled={updateState.loading}>
            {updateState.loading ? "Saving" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
