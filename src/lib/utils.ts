import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Gộp className an toàn khi dùng Tailwind (tránh xung đột class trùng nhóm).
// Dùng: cn("px-2", condition && "bg-navy-500", className)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
