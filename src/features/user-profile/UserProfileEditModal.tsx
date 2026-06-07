"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { getImageUrl } from "@/shared/api/client";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { formatAuthCredential } from "@/shared/lib/auth/contactCredential";
import { displayAccountEmail } from "@/shared/lib/displayAccountContact";
import { syncStoredUserAvatar, USER_EMAIL_STORAGE_KEY } from "@/shared/lib/hooks/useUser";
import volStyles from "@/app/(protected)/volunteer/profile/page.module.css";

const DEFAULT_AVATAR_SRC = "/event.png";

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === "string") {
      return detail[0].msg;
    }
  }
  return error instanceof Error ? error.message : "Не удалось сохранить профиль.";
}

export type UserProfileEditInitial = {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
};

type UserProfileEditModalProps = {
  open: boolean;
  initial: UserProfileEditInitial;
  onClose: () => void;
  onSaved: (data: { fullName: string; avatarUrl: string | null; email: string; phone: string }) => void;
};

export function UserProfileEditModal({ open, initial, onClose, onSaved }: UserProfileEditModalProps) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [fullName, setFullName] = useState(initial.fullName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(initial.fullName);
    setEmail(initial.email);
    setPhone(initial.phone);
    setAvatarUrl(initial.avatarUrl);
    setAvatarUploadError(null);
    setSaveError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleAvatarFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setAvatarUploadError(null);
    setAvatarUploading(true);
    try {
      const response = await meProfileApi.uploadAvatar(file);
      const nextUrl = response.avatar_url ? getImageUrl(response.avatar_url) : null;
      setAvatarUrl(nextUrl);
      syncStoredUserAvatar(nextUrl);
    } catch {
      setAvatarUploadError("Не удалось загрузить фото. Допустимы JPG, PNG или WebP.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    const nameTrim = fullName.trim();
    const emailTrim = email.trim();
    const phoneTrim = phone.trim();

    if (!emailTrim && !phoneTrim) {
      setSaveError("Укажите e-mail или номер телефона.");
      return;
    }
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setSaveError("Укажите корректный e-mail.");
      return;
    }
    if (phoneTrim) {
      const normalized = formatAuthCredential(phoneTrim);
      if (!normalized.startsWith("+") || normalized.replace(/\D/g, "").length < 10) {
        setSaveError("Укажите корректный номер телефона.");
        return;
      }
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const user_fields: {
        full_name: string | null;
        email?: string;
        phone?: string;
      } = {
        full_name: nameTrim || null,
      };

      if (emailTrim) {
        user_fields.email = emailTrim.toLowerCase();
      }
      user_fields.phone = phoneTrim ? formatAuthCredential(phoneTrim) : "";

      const res = await meProfileApi.patch({ user_fields });
      const savedEmail = displayAccountEmail(res.user.email);
      const savedPhone = res.user.phone?.trim() ?? "";
      const savedName =
        res.user.full_name?.trim() || savedEmail || savedPhone || nameTrim || "Профиль";

      if (savedEmail) {
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, savedEmail);
      }

      localStorage.setItem("userName", savedName);
      syncStoredUserAvatar(avatarUrl);

      onSaved({
        fullName: savedName,
        avatarUrl,
        email: savedEmail,
        phone: savedPhone,
      });
      onClose();
    } catch (e) {
      setSaveError(getApiErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={volStyles.modalOverlay} onClick={onClose}>
      <div
        className={volStyles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-edit-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="user-edit-modal-title" className={volStyles.modalTitle}>
          Редактирование профиля
        </h2>

        <div className={volStyles.modalFormInner}>
          <div className={volStyles.editAvatarBlock}>
            <div className={volStyles.editAvatarPreview}>
              <img src={avatarUrl ?? DEFAULT_AVATAR_SRC} alt="" />
            </div>
            <div className={volStyles.editAvatarActions}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={volStyles.avatarFileInput}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  void handleAvatarFileSelect(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className={volStyles.editAvatarBtn}
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarUploading ? "Загрузка…" : avatarUrl ? "Изменить фото" : "Добавить фото"}
              </button>
              <p className={volStyles.editAvatarHint}>JPG, PNG или WebP</p>
              {avatarUploadError ? (
                <p role="alert" className={volStyles.editAvatarError}>
                  {avatarUploadError}
                </p>
              ) : null}
            </div>
          </div>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>Имя</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Как к вам обращаться"
              autoComplete="name"
            />
          </label>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.ru"
              autoComplete="email"
            />
          </label>

          <label className={volStyles.field}>
            <span className={volStyles.fieldLabel}>Телефон</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 900 000-00-00"
              autoComplete="tel"
            />
          </label>

          {saveError ? (
            <p role="alert" style={{ marginBottom: "0.75rem", color: "#b3261e", fontSize: "0.9rem" }}>
              {saveError}
            </p>
          ) : null}

          <div className={volStyles.modalActions}>
            <button
              type="button"
              className={volStyles.modalPrimaryButton}
              disabled={isSaving || avatarUploading}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Сохранение…" : "Сохранить"}
            </button>
            <button
              type="button"
              className={volStyles.modalSecondaryButton}
              disabled={isSaving}
              onClick={onClose}
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
