"use client";

import { createRoot } from "react-dom/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Drop-in replacement for window.confirm() that shows the app's own dialog
// instead of the browser's "site says" box:
//   if (!(await confirmDialog({ title: "Delete?", description: "..." }))) return;
export function confirmDialog({ title = "Are you sure?", description = "", confirmText = "Confirm", cancelText = "Cancel" } = {}) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    // Cancel/Escape can fire both onClick and onOpenChange — close once.
    let done = false;
    const close = (result) => {
      if (done) return;
      done = true;
      root.unmount();
      host.remove();
      resolve(result);
    };

    root.render(
      <AlertDialog open onOpenChange={(open) => { if (!open) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="whitespace-pre-line">{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{cancelText}</AlertDialogCancel>
            <AlertDialogAction onClick={() => close(true)}>{confirmText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  });
}
