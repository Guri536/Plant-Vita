import * as React from "react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "default", ...props }) {
  const variants = {
    default: "bg-green-700 text-white hover:bg-green-800",
    outline: "border border-gray-300 hover:bg-gray-100"
  };

  return (
    <button
      className={cn(
        "px-4 py-2 rounded-md font-medium transition",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
