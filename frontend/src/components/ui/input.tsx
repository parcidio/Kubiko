import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-bz-sm border border-borda-forte bg-branco px-3 text-[15px] text-texto-corpo outline-none placeholder:text-cinza disabled:cursor-not-allowed disabled:opacity-50 md:text-base",
        "focus-visible:border-verde focus-visible:ring-[3px] focus-visible:ring-verde-medio/20",
        "aria-invalid:border-erro aria-invalid:ring-erro/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
