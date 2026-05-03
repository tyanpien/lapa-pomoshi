"use client";

import { useRouter } from "next/navigation";
import styles from "./AuthModal.module.css";

export function AuthModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className={styles.overlay} onClick={() => router.back()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
