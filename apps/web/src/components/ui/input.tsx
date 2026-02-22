import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-base border-2 border-border bg-secondary-background px-3 py-2 text-sm font-base text-foreground file:mr-3 file:rounded-base file:border-0 file:bg-main file:px-3 file:py-1 file:text-sm file:font-heading file:text-main-foreground placeholder:text-foreground/45 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-main focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
