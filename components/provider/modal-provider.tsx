"use client";

import { BackgroundModal } from "../modal/background-modal";
import { CardModal } from "../modal/card-modal";
import { ProModal } from "../modal/pro-modal";

export const ModalProvider = () => {
  return (
    <>
      <CardModal />
      <ProModal />
      <BackgroundModal />
    </>
  );
};
