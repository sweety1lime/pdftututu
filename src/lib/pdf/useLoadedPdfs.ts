"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useErrorToast } from "@/lib/useErrorToast";
import { formatBytes } from "@/lib/download";
import { usePendingFiles } from "@/lib/pendingFiles";
import { readPdfFile, type PdfSource } from "./load";
import { closePdfjs, openPdfjs } from "./pdfjs";
import { PdfError } from "./errors";

export interface LoadedPdf extends PdfSource {
  size: number;
  pageCount: number;
  doc: PDFDocumentProxy;
}

const BIG_FILE = 150 * 1024 * 1024;

/** Открыть файл: проверка, пароль, pdf.js. Бросает PdfError. */
export async function openLoadedPdf(file: File): Promise<LoadedPdf> {
  const src = await readPdfFile(file);
  let doc: PDFDocumentProxy;
  try {
    doc = await openPdfjs(src.bytes);
  } catch (e) {
    throw new PdfError("corrupted", file.name, e);
  }
  return { ...src, size: file.size, pageCount: doc.numPages, doc };
}

/**
 * Список открытых PDF с автоматическим освобождением памяти.
 * Файлы, переданные с главной, добавляются сами (pickUpPending: false — забрать их вручную).
 */
export function useLoadedPdfs({ pickUpPending = true }: { pickUpPending?: boolean } = {}) {
  const t = useTranslations("common");
  const showError = useErrorToast();
  const [files, setFiles] = useState<LoadedPdf[]>([]);
  const [loading, setLoading] = useState(false);
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => () => filesRef.current.forEach((f) => closePdfjs(f.doc)), []);

  const add = useCallback(
    async (incoming: File[]): Promise<LoadedPdf[]> => {
      setLoading(true);
      const added: LoadedPdf[] = [];
      try {
        // По очереди — чтобы диалоги пароля не накладывались
        for (const file of incoming) {
          if (file.size > BIG_FILE) toast.warning(t("bigFileWarning", { size: formatBytes(file.size) }));
          try {
            const loaded = await openLoadedPdf(file);
            added.push(loaded);
            setFiles((prev) => [...prev, loaded]);
          } catch (e) {
            showError(e);
          }
        }
      } finally {
        setLoading(false);
      }
      return added;
    },
    [showError, t],
  );

  usePendingFiles(add, pickUpPending);

  const remove = useCallback((id: string) => {
    setFiles((prev) => {
      closePdfjs(prev.find((f) => f.id === id)?.doc);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => closePdfjs(f.doc));
      return [];
    });
  }, []);

  return { files, setFiles, add, remove, clear, loading };
}
