"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      closeButton
      richColors
      expand={false}
      gap={8}
      visibleToasts={5}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:p-4 group-[.toaster]:min-w-[356px] group-[.toaster]:max-w-[420px]",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm group-[.toast]:mt-1",
          title: "group-[.toast]:font-semibold group-[.toast]:text-base",
          success:
            "group-[.toaster]:bg-green-50 group-[.toaster]:dark:bg-green-950/20 group-[.toaster]:border-green-200 group-[.toaster]:dark:border-green-800 group-[.toaster]:text-green-900 group-[.toaster]:dark:text-green-100",
          error:
            "group-[.toaster]:bg-red-50 group-[.toaster]:dark:bg-red-950/20 group-[.toaster]:border-red-200 group-[.toaster]:dark:border-red-800 group-[.toaster]:text-red-900 group-[.toaster]:dark:text-red-100",
          warning:
            "group-[.toaster]:bg-amber-50 group-[.toaster]:dark:bg-amber-950/20 group-[.toaster]:border-amber-200 group-[.toaster]:dark:border-amber-800 group-[.toaster]:text-amber-900 group-[.toaster]:dark:text-amber-100",
          info:
            "group-[.toaster]:bg-blue-50 group-[.toaster]:dark:bg-blue-950/20 group-[.toaster]:border-blue-200 group-[.toaster]:dark:border-blue-800 group-[.toaster]:text-blue-900 group-[.toaster]:dark:text-blue-100",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary/90 group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/80 group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-sm",
          closeButton:
            "group-[.toast]:!absolute group-[.toast]:!top-2 group-[.toast]:!right-2 group-[.toast]:!h-7 group-[.toast]:!w-7 group-[.toast]:!min-w-7 group-[.toast]:!p-0 group-[.toast]:!rounded-md group-[.toast]:!bg-transparent group-[.toast]:hover:!bg-muted/50 group-[.toast]:!text-muted-foreground group-[.toast]:hover:!text-foreground group-[.toast]:!transition-colors group-[.toast]:!flex group-[.toast]:!items-center group-[.toast]:!justify-center group-[.toast]:!opacity-60 group-[.toast]:hover:!opacity-100 group-[.toast]:!cursor-pointer group-[.toast]:!border-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

