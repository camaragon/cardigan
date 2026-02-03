import { create } from "zustand";

type BackgroundModalStore = {
  boardId?: string;
  isOpen: boolean;
  onOpen: (boardId: string) => void;
  onClose: () => void;
};

export const useBackgroundModal = create<BackgroundModalStore>((set) => ({
  boardId: undefined,
  isOpen: false,
  onOpen: (boardId: string) => set({ isOpen: true, boardId }),
  onClose: () => set({ isOpen: false, boardId: undefined }),
}));
