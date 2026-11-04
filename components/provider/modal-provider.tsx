"use client";

import { isPrivateMode } from "@/lib/private-mode";
import { CardModal } from "../modal/card-modal";
import { ProModal } from "../modal/pro-modal";

export const ModalProvider = () => {
  return (
    <>
      <CardModal />
      {!isPrivateMode && <ProModal />}
    </>
  );
};
