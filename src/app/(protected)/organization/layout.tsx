import type { ReactNode } from "react";
import { OrganizationSidebar } from "./OrganizationSidebar";
import styles from "./cabinetLayout.module.css";

export default function OrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.inner}>
        <aside className={styles.sidebar}>
          <OrganizationSidebar />
        </aside>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

