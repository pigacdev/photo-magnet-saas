"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useOptionalUnsavedChangesConfirm,
  useRegisterUnsavedChangesSave,
} from "@/components/dashboard/UnsavedChangesProvider";
import { UNSAVED_CHANGES_MESSAGE, allowPendingNavigation, shouldSkipBeforeUnload } from "@/lib/unsavedChanges";

export { UNSAVED_CHANGES_MESSAGE };

type UnsavedChangesWarningOptions = {
  message?: string;
  save?: () => Promise<boolean>;
};

/** Browser leave + same-origin link navigation guard. */
export function useUnsavedChangesWarning(
  active: boolean,
  options: UnsavedChangesWarningOptions = {},
) {
  const { message = UNSAVED_CHANGES_MESSAGE, save } = options;
  const router = useRouter();
  const confirmCtx = useOptionalUnsavedChangesConfirm();

  useRegisterUnsavedChangesSave(active && save ? save : null);

  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldSkipBeforeUnload()) return;
      event.preventDefault();
      event.returnValue = message;
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      void (async () => {
        const confirmed = confirmCtx
          ? await confirmCtx.confirmUnsavedChanges(message)
          : window.confirm(message);
        if (confirmed) {
          allowPendingNavigation();
          router.push(`${url.pathname}${url.search}${url.hash}`);
        }
      })();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [active, message, confirmCtx, router]);
}

export async function confirmUnsavedChanges(
  message: string = UNSAVED_CHANGES_MESSAGE,
  confirmCtx?: { confirmUnsavedChanges: (message?: string) => Promise<boolean> } | null,
): Promise<boolean> {
  if (confirmCtx) {
    return confirmCtx.confirmUnsavedChanges(message);
  }
  return window.confirm(message);
}
