"use client";

import { useEffect, useState } from "react";
import { CardModal } from "../modal/card-modal";

export const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; // Prevents rendering on the server
  }

  return (
    <>
      <CardModal />
    </>
  );
};
