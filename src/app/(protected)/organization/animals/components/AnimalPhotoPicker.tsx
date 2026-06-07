"use client";

import { useId, useRef } from "react";
import { animalsApi } from "@/shared/api/endpoints/animals";
import styles from "./animalPhotoPicker.module.css";

export const MAX_ANIMAL_FORM_PHOTOS = 3;

export type AnimalFormPhoto = {
  key: string;
  id?: number;
  previewUrl: string;
  isPrimary: boolean;
  isPending?: boolean;
  localFile?: File;
};

type AnimalPhotoPickerProps = {
  photos: AnimalFormPhoto[];
  animalId: number | null;
  canUseApi: boolean;
  onChange: (photos: AnimalFormPhoto[]) => void;
  onError?: (message: string) => void;
  onMutated?: () => void;
};

function newKey() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AnimalPhotoPicker({
  photos,
  animalId,
  canUseApi,
  onChange,
  onError,
  onMutated,
}: AnimalPhotoPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const reportError = (error: unknown) => {
    const msg =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Не удалось обработать фото.";
    onError?.(msg);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Не удалось прочитать файл"));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_ANIMAL_FORM_PHOTOS - photos.length;
    if (remaining <= 0) {
      onError?.(`Можно прикрепить не более ${MAX_ANIMAL_FORM_PHOTOS} фото.`);
      return;
    }
    const batch = Array.from(files).slice(0, remaining);

    void (async () => {
      let next = [...photos];
      for (const file of batch) {
        if (next.length >= MAX_ANIMAL_FORM_PHOTOS) break;

        if (canUseApi && animalId != null) {
          try {
            const uploaded = await animalsApi.uploadImage(animalId, file, next.length === 0);
            next = [
              ...next,
              {
                key: newKey(),
                id: uploaded.id,
                previewUrl: animalsApi.getImageUrl(uploaded.url),
                isPrimary: uploaded.is_primary,
                isPending: true,
              },
            ];
            onChange(next);
            onMutated?.();
          } catch (e) {
            reportError(e);
          }
          continue;
        }

        try {
          const previewUrl = await readFileAsDataUrl(file);
          const isFirst = next.length === 0;
          next = [
            ...next,
            {
              key: newKey(),
              previewUrl,
              isPrimary: isFirst,
              localFile: file,
            },
          ];
          onChange(next);
        } catch (e) {
          reportError(e);
        }
      }
    })().finally(() => {
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const removePhoto = (key: string) => {
    const target = photos.find((p) => p.key === key);
    if (!target) return;

    const applyLocal = () => {
      let next = photos.filter((p) => p.key !== key);
      if (target.isPrimary && next.length > 0) {
        next = next.map((p, i) => ({ ...p, isPrimary: i === 0 }));
      }
      onChange(next);
    };

    if (canUseApi && animalId != null && target.id != null) {
      void animalsApi
        .deleteImage(animalId, target.id)
        .then(() => {
          applyLocal();
          onMutated?.();
        })
        .catch((e) => reportError(e));
      return;
    }
    applyLocal();
  };

  const setPrimary = (key: string) => {
    const target = photos.find((p) => p.key === key);
    if (!target || target.isPrimary) return;

    const applyLocal = () => {
      onChange(photos.map((p) => ({ ...p, isPrimary: p.key === key })));
    };

    if (canUseApi && animalId != null && target.id != null) {
      void animalsApi
        .setPrimaryImage(animalId, target.id)
        .then(() => {
          onChange(photos.map((p) => ({ ...p, isPrimary: p.key === key })));
          onMutated?.();
        })
        .catch((e) => reportError(e));
      return;
    }
    applyLocal();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <span className={styles.label}>Фотографии</span>
        <span className={styles.hint}>
          {photos.length}/{MAX_ANIMAL_FORM_PHOTOS}
        </span>
      </div>

      {photos.length > 0 ? (
        <ul className={styles.grid}>
          {photos.map((photo) => (
            <li key={photo.key} className={styles.tile}>
              <img className={styles.thumb} src={photo.previewUrl} alt="" />
              {photo.isPrimary ? <span className={styles.primaryBadge}>Главное</span> : null}
              {photo.isPending ? <span className={styles.pendingBadge}>Новое</span> : null}
              <div className={styles.tileActions}>
                {!photo.isPrimary ? (
                  <button type="button" className={styles.tileBtn} onClick={() => setPrimary(photo.key)}>
                    Сделать главным
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${styles.tileBtn} ${styles.tileBtnDanger}`}
                  onClick={() => removePhoto(photo.key)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyHint}>Фото пока нет — добавьте до {MAX_ANIMAL_FORM_PHOTOS} снимков.</p>
      )}

      {photos.length < MAX_ANIMAL_FORM_PHOTOS ? (
        <>
          <input
            ref={inputRef}
            id={inputId}
            className={styles.hiddenInput}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button type="button" className={styles.addBtn} onClick={() => inputRef.current?.click()}>
            + Добавить фото
          </button>
        </>
      ) : null}
    </div>
  );
}
