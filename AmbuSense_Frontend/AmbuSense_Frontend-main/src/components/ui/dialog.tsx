"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background shadow-xl">
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pb-4", className)} {...props} />;
}

function DialogContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function DialogClose({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn("absolute right-4 top-4", className)}
      onClick={onClick}
      aria-label="Close dialog"
      size="icon"
      type="button"
      variant="ghost"
      {...props}
    >
      <X className="size-4" />
    </Button>
  );
}

export { Dialog, DialogClose, DialogContent, DialogHeader };
