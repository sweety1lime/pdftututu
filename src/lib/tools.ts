import {
  Combine,
  Contrast,
  EyeOff,
  FileCog,
  FilePenLine,
  FileType,
  FormInput,
  ImageDown,
  ImagePlus,
  LayoutGrid,
  ListOrdered,
  Lock,
  LockOpen,
  Minimize2,
  ScanText,
  Scissors,
  Signature,
  Stamp,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";

export type ToolId =
  | "editor"
  | "editText"
  | "sign"
  | "forms"
  | "redact"
  | "merge"
  | "split"
  | "organize"
  | "pageNumbers"
  | "imagesToPdf"
  | "pdfToImages"
  | "pdfToWord"
  | "ocr"
  | "grayscale"
  | "compress"
  | "protect"
  | "unlock"
  | "watermark"
  | "metadata";

export type ToolGroup = "edit" | "pages" | "convert" | "secure";

export interface Tool {
  id: ToolId;
  href: string;
  icon: LucideIcon;
  group: ToolGroup;
}

export const TOOLS: Tool[] = [
  { id: "editor", href: "/editor", icon: FilePenLine, group: "edit" },
  { id: "editText", href: "/edit-text", icon: TextCursorInput, group: "edit" },
  { id: "sign", href: "/sign", icon: Signature, group: "edit" },
  { id: "forms", href: "/fill-form", icon: FormInput, group: "edit" },
  { id: "redact", href: "/redact", icon: EyeOff, group: "edit" },
  { id: "merge", href: "/merge", icon: Combine, group: "pages" },
  { id: "split", href: "/split", icon: Scissors, group: "pages" },
  { id: "organize", href: "/organize", icon: LayoutGrid, group: "pages" },
  { id: "pageNumbers", href: "/page-numbers", icon: ListOrdered, group: "pages" },
  { id: "imagesToPdf", href: "/images-to-pdf", icon: ImagePlus, group: "convert" },
  { id: "pdfToImages", href: "/pdf-to-images", icon: ImageDown, group: "convert" },
  { id: "pdfToWord", href: "/pdf-to-word", icon: FileType, group: "convert" },
  { id: "ocr", href: "/ocr", icon: ScanText, group: "convert" },
  { id: "grayscale", href: "/grayscale", icon: Contrast, group: "convert" },
  { id: "compress", href: "/compress", icon: Minimize2, group: "secure" },
  { id: "protect", href: "/protect", icon: Lock, group: "secure" },
  { id: "watermark", href: "/watermark", icon: Stamp, group: "secure" },
  { id: "unlock", href: "/unlock", icon: LockOpen, group: "secure" },
  { id: "metadata", href: "/metadata", icon: FileCog, group: "secure" },
];

export const TOOL_GROUPS: ToolGroup[] = ["edit", "pages", "convert", "secure"];

/** Иконки всех инструментов одного цвета: янтарный — только для главного действия и выделения. */
export const TOOL_ICON_CLASS = "bg-secondary text-secondary-foreground";

/** Самые частые задачи — показываются первыми на главной и в «Других инструментах». */
export const POPULAR_TOOLS: ToolId[] = ["editor", "merge", "compress", "sign", "split"];

export function getTool(id: ToolId): Tool {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return tool;
}

/** Что ещё показать на странице инструмента: сначала из той же группы, потом популярные. */
export function relatedTools(id: ToolId, count = 4): Tool[] {
  const tool = getTool(id);
  const candidates = [...TOOLS.filter((t) => t.group === tool.group), ...POPULAR_TOOLS.map(getTool)];
  return [...new Set(candidates)].filter((t) => t.id !== id).slice(0, count);
}
