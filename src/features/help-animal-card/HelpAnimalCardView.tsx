"use client";

import styles from "./HelpAnimalCardView.module.css";
import type { HelpAnimalCardRendered } from "./helpAnimalCardModel";

export interface HelpAnimalCardViewProps {
  card: HelpAnimalCardRendered;
  onAction: (card: HelpAnimalCardRendered) => void;
  showOrganization?: boolean;
}

export function HelpAnimalCardView({
  card,
  onAction,
  showOrganization = true,
}: HelpAnimalCardViewProps) {
  return (
    <article className={styles.card}>
      <div className={styles.imageWrapper}>
        <img src={card.image} alt={card.name} className={styles.image} />
        {card.isUrgent ? <span className={styles.urgentBadge}>срочно</span> : null}
      </div>

      <div className={styles.cardBody}>
        <h2 className={styles.cardName}>{card.name}</h2>

        <div className={styles.metaTags}>
          <span className={styles.metaTag}>{card.species}</span>
          {card.age.trim() ? <span className={styles.metaTag}>{card.age}</span> : null}
          <span className={`${styles.metaTag} ${styles.statusTag}`}>{card.statusTag}</span>
        </div>

        {showOrganization ? (
          <p className={styles.lineWithIcon}>
            <img src="/org.svg" alt="" aria-hidden="true" />
            <span>{card.organization}</span>
          </p>
        ) : null}

        <p className={styles.need}>
          <img src={card.needIcon} alt="" aria-hidden="true" />
          <span>{card.needText}</span>
        </p>

        {card.amount ? (
          <p className={styles.amount}>{card.amount}</p>
        ) : (
          <div className={styles.amountPlaceholder} aria-hidden="true" />
        )}

        <button type="button" className={styles.actionButton} onClick={() => onAction(card)}>
          {card.actionLabel}
        </button>
      </div>
    </article>
  );
}
