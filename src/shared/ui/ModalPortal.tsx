"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalPortalProps = {
  children: ReactNode;
  lockScroll?: boolean;
};

export function ModalPortal({ children, lockScroll = true }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!lockScroll) return;
    const html = document.documentElement;
    html.classList.add("no-scroll");
    document.body.classList.add("no-scroll");
    return () => {
      html.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, [lockScroll]);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
