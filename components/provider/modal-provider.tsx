"use client";

import { CardModal } from "../modal/card-modal";
import { ProModal } from "../modal/pro-modal";

export const ModalProvider = () => {
  return (
    <>
      <CardModal />
      <ProModal />
    </>
  );
};
