import {
  Combine,
  FilePenLine,
  FormInput,
  ImageDown,
  ImagePlus,
  LayoutGrid,
  Lock,
  LockOpen,
  Minimize2,
  ScanText,
  Scissors,
  Signature,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";

export type ToolId =
  | "editor"
  | "editText"
  | "sign"
  | "forms"
  | "merge"
  | "split"
  | "organize"
  | "imagesToPdf"
  | "pdfToImages"
  | "ocr"
  | "compress"
  | "protect"
  | "unlock";

export type ToolGroup = "edit" | "pages" | "convert" | "secure";

export interface Tool {
  id: ToolId;
  href: string;
  icon: LucideIcon;
  group: ToolGroup;
  /** Tailwind-классы акцентного цвета плитки */
  accent: string;
}

export const TOOLS: Tool[] = [
  { id: "editor", href: "/editor", icon: FilePenLine, group: "edit", accent: "text-sky-600 bg-sky-500/10 dark:text-sky-400" },
  { id: "editText", href: "/edit-text", icon: TextCursorInput, group: "edit", accent: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400" },
  { id: "sign", href: "/sign", icon: Signature, group: "edit", accent: "text-violet-600 bg-violet-500/10 dark:text-violet-400" },
  { id: "forms", href: "/fill-form", icon: FormInput, group: "edit", accent: "text-fuchsia-600 bg-fuchsia-500/10 dark:text-fuchsia-400" },
  { id: "merge", href: "/merge", icon: Combine, group: "pages", accent: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400" },
  { id: "split", href: "/split", icon: Scissors, group: "pages", accent: "text-teal-600 bg-teal-500/10 dark:text-teal-400" },
  { id: "organize", href: "/organize", icon: LayoutGrid, group: "pages", accent: "text-green-600 bg-green-500/10 dark:text-green-400" },
  { id: "imagesToPdf", href: "/images-to-pdf", icon: ImagePlus, group: "convert", accent: "text-amber-600 bg-amber-500/10 dark:text-amber-400" },
  { id: "pdfToImages", href: "/pdf-to-images", icon: ImageDown, group: "convert", accent: "text-orange-600 bg-orange-500/10 dark:text-orange-400" },
  { id: "ocr", href: "/ocr", icon: ScanText, group: "convert", accent: "text-yellow-600 bg-yellow-500/10 dark:text-yellow-400" },
  { id: "compress", href: "/compress", icon: Minimize2, group: "secure", accent: "text-rose-600 bg-rose-500/10 dark:text-rose-400" },
  { id: "protect", href: "/protect", icon: Lock, group: "secure", accent: "text-red-600 bg-red-500/10 dark:text-red-400" },
  { id: "unlock", href: "/unlock", icon: LockOpen, group: "secure", accent: "text-pink-600 bg-pink-500/10 dark:text-pink-400" },
];

export const TOOL_GROUPS: ToolGroup[] = ["edit", "pages", "convert", "secure"];

export function getTool(id: ToolId): Tool {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return tool;
}
