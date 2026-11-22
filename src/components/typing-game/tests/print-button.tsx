"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" className="tap-btn tap-btn-primary tap-btn-md print:hidden" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" /> Print / Save as PDF
    </button>
  );
}
