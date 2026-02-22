import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import * as React from "react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-base border-2 border-border bg-secondary-background ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-main focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-main data-[state=checked]:text-main-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="size-4 text-main-foreground" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
