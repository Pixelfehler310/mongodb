import { create } from "zustand";

export type DatabaseMode = "mongo" | "postgres";

type DatabaseState = {
  mode: DatabaseMode;
  setMode: (mode: DatabaseMode) => void;
};

export const useDatabaseStore = create<DatabaseState>((set) => ({
  mode: "mongo",
  setMode: (mode) => set({ mode })
}));