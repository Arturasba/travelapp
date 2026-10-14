"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";

let scrollLocks = 0;
let previousOverflow = "";

/** Native modal focus containment, with shared scroll locking for panel switches. */
export function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!open) { if (element.open) element.close(); return; }
    if (!element.open) element.showModal();
    if (scrollLocks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      // React Strict Mode replays effects. Closing here would queue a stale
      // native close event that dismisses the freshly reopened dialog.
      // A removed dialog leaves the browser's top layer automatically.
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  return ref;
}

/** Dialog padding and content are inside; only the actual backdrop dismisses. */
export function isDialogBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}
