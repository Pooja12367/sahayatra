"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DropdownMenuContext = React.createContext<{
  close: () => void;
} | null>(null);

type DropdownMenuProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  side?: "bottom" | "top";
};

function DropdownMenu({ trigger, children, side = "bottom" }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<React.CSSProperties>({
    right: 0,
    top: 0,
    visibility: "hidden",
  });

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current || !contentRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const menuHeight = contentRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const shouldShowAbove =
      side === "top" ||
      (side === "bottom" && spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow);

    setPosition(
      shouldShowAbove
        ? {
            bottom: window.innerHeight - rect.top + 8,
            right,
            visibility: "visible",
          }
        : {
            top: rect.bottom + 8,
            right,
            visibility: "visible",
          },
    );
  }, [open, side]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open ? (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-[1190] cursor-default"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            ref={contentRef}
            className="fixed z-[1200] min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
            style={position}
          >
            <DropdownMenuContext.Provider value={{ close: () => setOpen(false) }}>
              {children}
            </DropdownMenuContext.Provider>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DropdownMenuItem({
  className,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const context = React.useContext(DropdownMenuContext);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        context?.close();
      }}
      type="button"
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuItem };
