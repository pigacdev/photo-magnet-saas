"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UNSAVED_CHANGES_MESSAGE, allowPendingNavigation } from "@/lib/unsavedChanges";
import { UnsavedChangesDialog } from "@/components/dashboard/UnsavedChangesDialog";

type SaveHandler = () => Promise<boolean>;

type UnsavedChangesContextValue = {
  confirmUnsavedChanges: (message?: string) => Promise<boolean>;
  registerSaveHandler: (handler: SaveHandler | null) => void;
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
  const [saving, setSaving] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const saveHandlerRef = useRef<SaveHandler | null>(null);

  const registerSaveHandler = useCallback((handler: SaveHandler | null) => {
    saveHandlerRef.current = handler;
  }, []);

  const finish = useCallback((confirmed: boolean) => {
    if (confirmed) {
      allowPendingNavigation();
    }
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOpen(false);
    setSaving(false);
  }, []);

  const handleSave = useCallback(async () => {
    const handler = saveHandlerRef.current;
    if (!handler) {
      finish(false);
      return;
    }

    setSaving(true);
    try {
      const saved = await handler();
      finish(saved);
    } catch {
      finish(false);
    }
  }, [finish]);

  const confirmUnsavedChanges = useCallback(
    (nextMessage: string = UNSAVED_CHANGES_MESSAGE) => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setMessage(nextMessage);
        setSaving(false);
        setOpen(true);
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ confirmUnsavedChanges, registerSaveHandler }),
    [confirmUnsavedChanges, registerSaveHandler],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        open={open}
        message={message}
        saving={saving}
        onSave={() => void handleSave()}
        onDismiss={() => finish(false)}
        onLeave={() => finish(true)}
      />
    </UnsavedChangesContext.Provider>
  );
}

export function useRegisterUnsavedChangesSave(save: SaveHandler | null) {
  const ctx = useContext(UnsavedChangesContext);

  useEffect(() => {
    if (!ctx || !save) return;
    ctx.registerSaveHandler(save);
    return () => {
      ctx.registerSaveHandler(null);
    };
  }, [ctx, save]);
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
