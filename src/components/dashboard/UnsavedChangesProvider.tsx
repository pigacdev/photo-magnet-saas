"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { UNSAVED_CHANGES_MESSAGE, allowPendingNavigation } from "@/lib/unsavedChanges";
import { UnsavedChangesDialog } from "@/components/dashboard/UnsavedChangesDialog";

type UnsavedChangesContextValue = {
  confirmUnsavedChanges: (message?: string) => Promise<boolean>;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(UNSAVED_CHANGES_MESSAGE);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const finish = useCallback((confirmed: boolean) => {
    if (confirmed) {
      allowPendingNavigation();
    }
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const confirmUnsavedChanges = useCallback(
    (nextMessage: string = UNSAVED_CHANGES_MESSAGE) => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setMessage(nextMessage);
        setOpen(true);
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ confirmUnsavedChanges }),
    [confirmUnsavedChanges],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={open}
        message={message}
        onStay={() => finish(false)}
        onLeave={() => finish(true)}
      />
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesConfirm(): UnsavedChangesContextValue {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error(
      "useUnsavedChangesConfirm must be used within UnsavedChangesProvider",
    );
  }
  return ctx;
}

export function useOptionalUnsavedChangesConfirm(): UnsavedChangesContextValue | null {
  return useContext(UnsavedChangesContext);
}
