import { normalizeArticleContent } from "@/shared/lib/articleContent";
import styles from "./ArticleFormattedContent.module.css";

type ArticleFormattedContentProps = {
  text: string;
  className?: string;
  variant?: "body" | "excerpt";
};

export function ArticleFormattedContent({
  text,
  className,
  variant = "body",
}: ArticleFormattedContentProps) {
  const normalized = normalizeArticleContent(text);
  if (!normalized) return null;
  const variantClass = variant === "excerpt" ? styles.excerpt : styles.root;
  const rootClass = className ? `${variantClass} ${className}` : variantClass;
  return <div className={rootClass}>{normalized}</div>;
}
