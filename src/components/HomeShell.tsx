"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { FileActions } from "./FileActions";

const OpenFile = createContext<(file: File) => void>(() => {});

/** Открыть один PDF на главной — вместо главной появится «Что сделать с файлом?». */
export const useOpenFile = () => useContext(OpenFile);

/** Главная или экран выбора действия для открытого файла (адрес при этом не меняется). */
export function HomeShell({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const close = useCallback(() => setFile(null), []);

  if (file) {
    return (
      <FileActions
        key={`${file.name}:${file.size}:${file.lastModified}`}
        file={file}
        onReplace={setFile}
        onClose={close}
      />
    );
  }
  return <OpenFile.Provider value={setFile}>{children}</OpenFile.Provider>;
}
