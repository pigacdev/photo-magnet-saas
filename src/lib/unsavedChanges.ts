export const UNSAVED_CHANGES_MESSAGE =
  "All unsaved changes will be lost. Leave this page?";

/** Set before programmatic navigation after the user confirms leaving. */
let skipNextBeforeUnload = false;

export function allowPendingNavigation() {
  skipNextBeforeUnload = true;
}

export function shouldSkipBeforeUnload(): boolean {
  return skipNextBeforeUnload;
}
