"use client";

import { useId, useRef } from "react";
import { DEFAULT_KNOWLEDGE_COVER_SRC } from "@/shared/lib/knowledgeCover";
import { KnowledgeArticleCover } from "@/shared/ui/KnowledgeArticleCover/KnowledgeArticleCover";
import styles from "./ArticleCoverPicker.module.css";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ArticleCoverPickerProps = {
  previewUrl: string | null;
  onFileSelect: (file: File | null, previewUrl: string | null) => void;
  disabled?: boolean;
};

export function ArticleCoverPicker({ previewUrl, onFileSelect, disabled }: ArticleCoverPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasCustom = Boolean(previewUrl?.trim());

  const handleChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      onFileSelect(null, previewUrl);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      onFileSelect(file, result);
    };
    reader.onerror = () => onFileSelect(null, previewUrl);
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Обложка статьи</span>
      <div className={styles.previewBox}>
        {hasCustom ? (
          <img src={previewUrl!} alt="" />
        ) : (
          <KnowledgeArticleCover alt="" />
        )}
      </div>
      <div className={styles.actions}>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className={styles.fileInput}
          disabled={disabled}
          onChange={(e) => {
            handleChange(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={styles.pickBtn}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {hasCustom ? "Заменить фото" : "Загрузить фото"}
        </button>
        {hasCustom ? (
          <button
            type="button"
            className={styles.removeBtn}
            disabled={disabled}
            onClick={() => onFileSelect(null, null)}
          >
            Убрать
          </button>
        ) : null}
      </div>
      <p className={styles.hint}>JPG, PNG или WebP, до 5 МБ. Без фото на сайте будет стандартная картинка.</p>
    </div>
  );
}
