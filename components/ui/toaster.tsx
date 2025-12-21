"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:!absolute group-[.toast]:!top-2 group-[.toast]:!right-2 group-[.toast]:!h-8 group-[.toast]:!w-8 group-[.toast]:!min-w-8 group-[.toast]:!p-0 group-[.toast]:!rounded-md group-[.toast]:!bg-muted/80 group-[.toast]:!text-muted-foreground group-[.toast]:hover:!bg-destructive group-[.toast]:hover:!text-destructive-foreground group-[.toast]:!transition-colors group-[.toast]:!flex group-[.toast]:!items-center group-[.toast]:!justify-center group-[.toast]:!opacity-70 group-[.toast]:hover:!opacity-100 group-[.toast]:!cursor-pointer",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

