"use client";

import { create } from "zustand";

interface PromptState {
  open: boolean;
  fileName: string;
  wrong: boolean;
  /** Номер запроса — чтобы форма сбрасывалась при каждом новом вопросе */
  attempt: number;
  resolve: ((password: string | null) => void) | null;
  /** Показать диалог и дождаться пароля (null — пользователь отменил). */
  ask: (fileName: string, wrong: boolean) => Promise<string | null>;
  answer: (password: string | null) => void;
}

export const usePasswordPrompt = create<PromptState>((set, get) => ({
  open: false,
  fileName: "",
  wrong: false,
  attempt: 0,
  resolve: null,
  ask: (fileName, wrong) =>
    new Promise((resolve) => {
      get().resolve?.(null);
      set((s) => ({ open: true, fileName, wrong, resolve, attempt: s.attempt + 1 }));
    }),
  answer: (password) => {
    get().resolve?.(password);
    set({ open: false, resolve: null });
  },
}));

export const askPassword = (fileName: string, wrong: boolean) =>
  usePasswordPrompt.getState().ask(fileName, wrong);
