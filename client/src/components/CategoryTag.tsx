import React from "react";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
  Computer: { bg: "bg-[#e9ecff] dark:bg-[#29305c]", text: "text-[#5367f2] dark:text-[#cdd3ff]", dot: "bg-[#5367f2]" },
  Accessories: { bg: "bg-[#e4f7ef] dark:bg-[#173d35]", text: "text-[#178a68] dark:text-[#77d9b8]", dot: "bg-[#31b88b]" },
  Peripheral: { bg: "bg-[#fde8ef] dark:bg-[#4c2635]", text: "text-[#bd5275] dark:text-[#f3a5bd]", dot: "bg-[#eb6f92]" },
  Cables: { bg: "bg-[#fff2dd] dark:bg-[#4b3623]", text: "text-[#b77428] dark:text-[#f2c47e]", dot: "bg-[#f1a85b]" },
  "Misc.": { bg: "bg-[#eee9ff] dark:bg-[#302658]", text: "text-[#7659d5] dark:text-[#c7baff]", dot: "bg-[#8b79e8]" },
};

export function CategoryTag({ category }: { category: string }) {
  const colors = categoryColors[category] || { bg: "bg-slate-100 dark:bg-white/10", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-500" };
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold", colors.bg, colors.text)}><span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />{category}</span>;
}
