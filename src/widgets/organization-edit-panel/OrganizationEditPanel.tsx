"use client";

import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./OrganizationEditPanel.module.css";
import { getImageUrl } from "@/shared/api/client";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import type { OrganizationProfileData, OrganizationSocialExtra } from "@/shared/lib/organizationCabinet";
import { buildOrganizationCabinetProfilePatch } from "@/shared/lib/organizationMeCabinet";
import { syncStoredUserAvatar, useUser } from "@/shared/lib/hooks/useUser";

const MESSENGER_OPTIONS = ["VK", "Telegram", "WhatsApp", "Одноклассники", "Другое"];

const MAIN_NAV: { href: string; label: string; matchPrefix?: string; skipActiveHighlight?: boolean }[] = [
  { href: "/organization/profile", label: "Профиль", matchPrefix: "/organization/profile" },
  { href: "/organization/requests", label: "Мои заявки", matchPrefix: "/organization/requests" },
  { href: "/organization/animals", label: "Мои подопечные", matchPrefix: "/organization/animals" },
  { href: "/organization/incoming", label: "Входящие заявки", matchPrefix: "/organization/incoming" },
  { href: "/messages", label: "Сообщения", matchPrefix: "/messages" },
  { href: "/organization/home", label: "Привет из дома", matchPrefix: "/organization/home" },
  { href: "/organization/events", label: "Мои мероприятия", matchPrefix: "/organization/events" },
  { href: "/organization/articles", label: "Мои статьи", matchPrefix: "/organization/articles" },
  { href: "/organization/reports", label: "Мои отчеты", matchPrefix: "/organization/reports" },
];

type EditSection = "profile" | "contacts" | "about" | "instructions";

function pickMediaUploadUrl(res: unknown): string {
  if (!res || typeof res !== "object") return "";
  const o = res as Record<string, unknown>;
  return (
    (typeof o.logo_url === "string" && o.logo_url) ||
    (typeof o.cover_url === "string" && o.cover_url) ||
    (typeof o.gallery_url === "string" && o.gallery_url) ||
    (typeof o.url === "string" && o.url) ||
    (typeof o.image_url === "string" && o.image_url) ||
    ""
  );
}

const PHONE_MASK = "+7 (___) ___-__-__";
const PHONE_POSITIONS = [4, 5, 6, 9, 10, 11, 13, 14, 16, 17] as const;

function normalizePhoneDigits(raw: string) {
  let digits = raw.replace(/\D/g, "");
  const trimmed = raw.trim();
  if (trimmed.startsWith("+7") && digits.startsWith("7")) digits = digits.slice(1);
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(0, 10);
  return digits;
}

function applyPhoneDigits(digitsRaw: string) {
  const digits = normalizePhoneDigits(digitsRaw);
  const chars = PHONE_MASK.split("");
  for (let i = 0; i < PHONE_POSITIONS.length; i++) {
    const pos = PHONE_POSITIONS[i];
    const d = digits[i];
    chars[pos] = d ? d : "_";
  }
  return chars.join("");
}

function nextEditablePos(value: string, from: number) {
  for (const pos of PHONE_POSITIONS) {
    if (pos >= from && value[pos] === "_") return pos;
  }
  for (const pos of PHONE_POSITIONS) {
    if (value[pos] === "_") return pos;
  }
  return null;
}

function prevEditablePos(from: number) {
  for (let i = PHONE_POSITIONS.length - 1; i >= 0; i--) {
    const pos = PHONE_POSITIONS[i];
    if (pos < from) return pos;
  }
  return null;
}

type OrganizationEditPanelProps = {
  open: boolean;
  onClose: () => void;
  profile: OrganizationProfileData;
  setProfile: Dispatch<SetStateAction<OrganizationProfileData>>;
  onSave: () => void;
  saved: boolean;
  variant?: "overlay" | "inline";
};

export function OrganizationEditPanel({
  open,
  onClose,
  profile,
  setProfile,
  onSave,
  saved,
  variant = "overlay",
}: OrganizationEditPanelProps) {
  const { role } = useUser();
  const pathname = usePathname();
  const [section, setSection] = useState<EditSection>("profile");
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const savedScrollYRef = useRef(0);

  useLayoutEffect(() => {
    if (variant !== "overlay") return;
    if (!open) return;

    const html = document.documentElement;
    savedScrollYRef.current = window.scrollY;
    window.scrollTo(0, 0);
    html.classList.add("no-scroll");
    document.body.classList.add("no-scroll");

    const shell = shellRef.current;
    if (!shell) {
      return () => {
        html.classList.remove("no-scroll");
        document.body.classList.remove("no-scroll");
        window.scrollTo(0, savedScrollYRef.current);
      };
    }

    const updateInsets = () => {
      const header = document.querySelector("header");
      const footer = document.querySelector("footer");
      const rawTop = header ? header.getBoundingClientRect().bottom : 88;
      const topPx = Math.max(0, Math.round(rawTop));
      const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
      const bottomPx = Math.max(0, Math.round(window.innerHeight - footerTop));
      shell.style.setProperty("--org-edit-top", `${topPx}px`);
      shell.style.setProperty("--org-edit-bottom", `${bottomPx}px`);
    };

    updateInsets();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            requestAnimationFrame(updateInsets);
          })
        : null;
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    if (ro) {
      if (header) ro.observe(header);
      if (footer) ro.observe(footer);
    }
    window.addEventListener("resize", updateInsets);
    window.addEventListener("scroll", updateInsets, true);
    const id = requestAnimationFrame(updateInsets);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", updateInsets);
      window.removeEventListener("scroll", updateInsets, true);
      ro?.disconnect();
      html.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
      window.scrollTo(0, savedScrollYRef.current);
    };
  }, [open, variant]);

  const readFileAsDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("read"));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const onCoverFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (role === "organization") {
      try {
        const res = await meOrganizationApi.uploadCover(file);
        const u = pickMediaUploadUrl(res);
        if (u) {
          setProfile((prev) => ({ ...prev, coverDataUrl: getImageUrl(u) }));
          return;
        }
      } catch {
      }
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfile((prev) => ({ ...prev, coverDataUrl: dataUrl }));
    } catch {
    }
  };

  const onLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (role === "organization") {
      try {
        const res = await meOrganizationApi.uploadLogo(file);
        const u = pickMediaUploadUrl(res);
        if (u) {
          const logoUrl = getImageUrl(u);
          setProfile((prev) => ({ ...prev, logoDataUrl: logoUrl }));
          syncStoredUserAvatar(logoUrl);
          return;
        }
      } catch {
      }
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfile((prev) => ({ ...prev, logoDataUrl: dataUrl }));
    } catch {
    }
  };

  const appendGalleryFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    const urls: string[] = [];
    for (const file of images) {
      if (urls.length >= 5) break;
      if (role === "organization") {
        try {
          const res = await meOrganizationApi.uploadGalleryImage(file);
          const u = pickMediaUploadUrl(res);
          if (u) {
            urls.push(getImageUrl(u));
            continue;
          }
        } catch {
        }
      }
      try {
        urls.push(await readFileAsDataUrl(file));
      } catch {
      }
    }
    if (!urls.length) return;
    setProfile((prev) => ({
      ...prev,
      galleryDataUrls: [...prev.galleryDataUrls, ...urls].slice(0, 5),
    }));
  };

  const onGalleryFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (!files.length) return;
    await appendGalleryFiles(files);
  };

  const removeGalleryAt = (index: number) => {
    let nextProfile: OrganizationProfileData | null = null;
    flushSync(() => {
      setProfile((prev) => {
        nextProfile = { ...prev, galleryDataUrls: prev.galleryDataUrls.filter((_, i) => i !== index) };
        return nextProfile;
      });
    });
    if (role === "organization" && nextProfile) {
      void meOrganizationApi
        .patchProfileCabinet(buildOrganizationCabinetProfilePatch(nextProfile))
        .catch(() => {});
    }
  };

  const addSocialRow = () => {
    setProfile((prev) => ({
      ...prev,
      extraSocialLinks: [
        ...prev.extraSocialLinks,
        { id: `soc-${Date.now()}`, messenger: "", url: "" },
      ],
    }));
  };

  const updateSocialRow = (id: string, patch: Partial<OrganizationSocialExtra>) => {
    setProfile((prev) => ({
      ...prev,
      extraSocialLinks: prev.extraSocialLinks.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  };

  const removeSocialRow = (id: string) => {
    setProfile((prev) => ({
      ...prev,
      extraSocialLinks: prev.extraSocialLinks.filter((row) => row.id !== id),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  const isLeftNavActive = (item: (typeof MAIN_NAV)[number]) => {
    if (item.skipActiveHighlight || !item.matchPrefix) return false;
    return pathname === item.href || pathname.startsWith(`${item.matchPrefix}/`);
  };

  if (!open) return null;
  const isOverlay = variant === "overlay";

  const panel = (
    <div
      ref={shellRef}
      className={`${styles.shell} ${!isOverlay ? styles.shellInline : ""}`.trim()}
      role={isOverlay ? "dialog" : undefined}
      aria-modal={isOverlay ? "true" : undefined}
      aria-label="Редактирование профиля организации"
    >
      <div className={styles.layout}>
        {isOverlay ? (
          <nav className={styles.leftNav} aria-label="Разделы личного кабинета">
            {MAIN_NAV.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`${styles.leftNavLink} ${isLeftNavActive(item) ? styles.leftNavLinkActive : ""}`}
                onClick={onClose}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className={styles.scrollMain}>
          <div className={styles.center}>
            <form className={styles.formStack} onSubmit={handleSubmit}>

            <div className={styles.coverBlock}>
              <button type="button" className={styles.closeBtn} onClick={onClose}>
                {isOverlay ? "Закрыть" : "Выйти"}
              </button>
              {profile.coverDataUrl ? (
                <img src={profile.coverDataUrl} alt="" className={styles.coverImage} />
              ) : null}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className={styles.coverFile}
                onChange={onCoverFile}
                aria-hidden
              />
              <button type="button" className={styles.coverChangeBtn} onClick={() => coverInputRef.current?.click()}>
                Изменить обложку
              </button>
            </div>

            <div className={styles.avatarRow}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className={styles.coverFile}
                onChange={onLogoFile}
                aria-hidden
              />
              <button
                type="button"
                className={styles.avatarCircle}
                onClick={() => logoInputRef.current?.click()}
                aria-label="Изменить фото организации"
              >
                {profile.logoDataUrl ? (
                  <img src={profile.logoDataUrl} alt="" className={styles.avatarImg} />
                ) : (
                  <span className={styles.avatarCamera} aria-hidden>
                    <img src="/camera.svg" alt="Изменить фото организации" />
                  </span>
                )}
              </button>
            </div>

            {section === "profile" ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Название организации</span>
                  <input
                    className={styles.fieldInput}
                    value={profile.organizationName}
                    onChange={(e) => setProfile((p) => ({ ...p, organizationName: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Специализация</span>
                  <input
                    className={styles.fieldInput}
                    value={profile.specialization}
                    onChange={(e) => setProfile((p) => ({ ...p, specialization: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Об организации</span>
                  <textarea
                    className={styles.fieldTextarea}
                    value={profile.description}
                    onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Расскажите о фонде или приюте"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Местоположение</span>
                  <input
                    className={styles.fieldInput}
                    value={profile.territory}
                    onChange={(e) => setProfile((p) => ({ ...p, territory: e.target.value }))}
                  />
                </label>
              </>
            ) : null}

            {section === "contacts" ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Телефон</span>
                  <input
                    ref={phoneInputRef}
                    className={styles.fieldInput}
                    value={profile.phone?.trim() ? applyPhoneDigits(profile.phone) : PHONE_MASK}
                    inputMode="tel"
                    autoComplete="tel"
                    onFocus={() => {
                      setProfile((p) => ({ ...p, phone: applyPhoneDigits(p.phone || "") }));
                      requestAnimationFrame(() => {
                        const el = phoneInputRef.current;
                        if (!el) return;
                        const pos = nextEditablePos(el.value, el.selectionStart ?? 0);
                        if (pos == null) return;
                        el.setSelectionRange(pos, pos);
                      });
                    }}
                    onKeyDown={(e) => {
                      const el = e.currentTarget;
                      const start = el.selectionStart ?? 0;
                      const end = el.selectionEnd ?? 0;
                      const current = applyPhoneDigits(profile.phone || "");

                      const setAndCaret = (next: string, caretPos: number | null) => {
                        setProfile((p) => ({ ...p, phone: next }));
                        requestAnimationFrame(() => {
                          if (caretPos == null) return;
                          el.setSelectionRange(caretPos, caretPos);
                        });
                      };

                      if (e.key === "Backspace") {
                        e.preventDefault();
                        const pos = prevEditablePos(start);
                        if (pos == null) return;
                        const chars = current.split("");
                        chars[pos] = "_";
                        setAndCaret(chars.join(""), pos);
                        return;
                      }

                      if (e.key === "Delete") {
                        e.preventDefault();
                        const pos = PHONE_POSITIONS.find((p) => p >= start) ?? null;
                        if (pos == null) return;
                        const chars = current.split("");
                        chars[pos] = "_";
                        setAndCaret(chars.join(""), pos);
                        return;
                      }

                      if (e.key.length === 1 && /\d/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        const chars = current.split("");

                        if (start !== end) {
                          for (const pos of PHONE_POSITIONS) {
                            if (pos >= start && pos < end) chars[pos] = "_";
                          }
                        }

                        const insertPos = nextEditablePos(chars.join(""), start);
                        if (insertPos == null) return; 
                        chars[insertPos] = e.key;
                        const nextValue = chars.join("");
                        const caret = nextEditablePos(nextValue, insertPos + 1) ?? insertPos + 1;
                        setAndCaret(nextValue, caret);
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const start = el.selectionStart ?? 0;
                      const end = el.selectionEnd ?? 0;
                      const digits = normalizePhoneDigits(e.clipboardData.getData("text") || "");
                      if (!digits) return;

                      const current = applyPhoneDigits(profile.phone || "");
                      const chars = current.split("");

                      if (start !== end) {
                        for (const pos of PHONE_POSITIONS) {
                          if (pos >= start && pos < end) chars[pos] = "_";
                        }
                      }

                      let idx = 0;
                      let pos: number | null = nextEditablePos(chars.join(""), start);
                      while (pos != null && idx < digits.length) {
                        chars[pos] = digits[idx];
                        idx++;
                        pos = nextEditablePos(chars.join(""), pos + 1);
                      }

                      const nextValue = chars.join("");
                      setProfile((p) => ({ ...p, phone: nextValue }));
                      requestAnimationFrame(() => {
                        const caret = nextEditablePos(nextValue, start) ?? (PHONE_POSITIONS.at(-1) ?? 0) + 1;
                        el.setSelectionRange(caret, caret);
                      });
                    }}
                    onChange={(e) => {
                      setProfile((p) => ({ ...p, phone: applyPhoneDigits(e.target.value) }));
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>E-mail</span>
                  <input
                    className={styles.fieldInput}
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    placeholder="info@example.ru"
                  />
                </label>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Социальные сети</span>
                  <label className={styles.field} style={{ marginBottom: 12 }}>
                    <span className={styles.fieldLabel}>ВКонтакте</span>
                    <input
                      className={styles.fieldInput}
                      type="url"
                      inputMode="url"
                      value={profile.vkUrl}
                      onChange={(e) => setProfile((p) => ({ ...p, vkUrl: e.target.value }))}
                      placeholder="https://vk.com/…"
                    />
                  </label>
                  <label className={styles.field} style={{ marginBottom: 12 }}>
                    <span className={styles.fieldLabel}>Telegram</span>
                    <input
                      className={styles.fieldInput}
                      type="url"
                      inputMode="url"
                      value={profile.telegramUrl}
                      onChange={(e) => setProfile((p) => ({ ...p, telegramUrl: e.target.value }))}
                      placeholder="https://t.me/…"
                    />
                  </label>
                  <label className={styles.field} style={{ marginBottom: 12 }}>
                    <span className={styles.fieldLabel}>WhatsApp</span>
                    <input
                      className={styles.fieldInput}
                      type="url"
                      inputMode="url"
                      value={profile.whatsappUrl}
                      onChange={(e) => setProfile((p) => ({ ...p, whatsappUrl: e.target.value }))}
                      placeholder="https://wa.me/…"
                    />
                  </label>
                  {profile.extraSocialLinks.map((row) => (
                    <div key={row.id} className={styles.socialBlock}>
                      <div className={styles.socialRow}>
                        <label className={styles.field} style={{ marginBottom: 0 }}>
                          <div
                            className={`${styles.selectWrap} ${openSelectId === row.id ? styles.selectWrapOpen : ""}`.trim()}
                            onMouseDown={() => setOpenSelectId(row.id)}
                          >
                            <select
                              className={styles.select}
                              value={row.messenger}
                              onBlur={() => setOpenSelectId((prev) => (prev === row.id ? null : prev))}
                              onChange={(e) => {
                                updateSocialRow(row.id, { messenger: e.target.value });
                                setOpenSelectId(null);
                                e.currentTarget.blur();
                              }}
                            >
                              <option value="" disabled hidden>
                                Выберите социальную сеть / мессенджер
                              </option>
                              {MESSENGER_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </label>
                        <label className={styles.field} style={{ marginBottom: 0 }}>
                          <input
                            className={styles.fieldInput}
                            value={row.url}
                            onChange={(e) => updateSocialRow(row.id, { url: e.target.value })}
                            placeholder="Введите ссылку"
                          />
                        </label>
                      </div>
                      <button type="button" className={styles.removeRowBtn} onClick={() => removeSocialRow(row.id)}>
                        Удалить
                      </button>
                    </div>
                  ))}
                  <button type="button" className={styles.addLink} onClick={addSocialRow}>
                    + Добавить
                  </button>
                </div>
              </>
            ) : null}

            {section === "about" ? (
              <>
                <div className={styles.richBlock}>
                  <span className={styles.fieldLabel}>История организации</span>
                  <textarea
                    className={`${styles.fieldTextarea} ${styles.richTextarea}`}
                    value={profile.organizationHistory}
                    onChange={(e) => setProfile((p) => ({ ...p, organizationHistory: e.target.value }))}
                    placeholder="Расскажите, как появилась ваша организация"
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Изображения</span>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className={styles.coverFile}
                    onChange={onGalleryFiles}
                    aria-hidden
                  />
                  <div
                    className={styles.galleryZone}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const files = Array.from(e.dataTransfer.files);
                      void appendGalleryFiles(files);
                    }}
                  >
                    <button type="button" className={styles.galleryBtn} onClick={() => galleryInputRef.current?.click()}>
                      + Добавить фото
                    </button>
                    <p className={styles.galleryHint}>
                      Перетащите изображения сюда или нажмите, чтобы выбрать файлы.
                      <br />
                      JPG, PNG. Не более 5 фотографий до 5 МБ.
                    </p>
                  </div>
                  {profile.galleryDataUrls.length > 0 ? (
                    <div className={styles.galleryStrip}>
                      {profile.galleryDataUrls.map((src, i) => (
                        <div key={`${i}-${src.slice(0, 32)}`} className={styles.galleryThumb}>
                          <img src={src} alt="" />
                          <button
                            type="button"
                            className={styles.galleryRemove}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeGalleryAt(i);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>ИНН</span>
                  <input
                    className={styles.fieldInput}
                    value={profile.inn}
                    onChange={(e) => setProfile((p) => ({ ...p, inn: e.target.value }))}
                    placeholder="Введите ИНН"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>ОГРН</span>
                  <input
                    className={styles.fieldInput}
                    value={profile.ogrn}
                    onChange={(e) => setProfile((p) => ({ ...p, ogrn: e.target.value }))}
                    placeholder="Введите ОГРН"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Расчётный счёт</span>
                  <input
                    className={styles.fieldInput}
                    value={profile.bankAccount}
                    onChange={(e) => setProfile((p) => ({ ...p, bankAccount: e.target.value }))}
                    placeholder="Введите номер расчетного счета"
                  />
                </label>
              </>
            ) : null}

            {section === "instructions" ? (
              <>
                <div className={styles.richBlock}>
                  <span className={styles.fieldLabel}>Как приютить питомца</span>
                  <textarea
                    className={`${styles.fieldTextarea} ${styles.richTextarea}`}
                    value={profile.adoptionScenario}
                    onChange={(e) => setProfile((p) => ({ ...p, adoptionScenario: e.target.value }))}
                    placeholder="Расскажите о процессе"
                  />
                </div>
                <div className={styles.richBlock}>
                  <span className={styles.fieldLabel}>Правила приёма животных</span>
                  <textarea
                    className={`${styles.fieldTextarea} ${styles.richTextarea}`}
                    value={profile.admissionRules}
                    onChange={(e) => setProfile((p) => ({ ...p, admissionRules: e.target.value }))}
                    placeholder="Опишите, на каких условиях ваш приют принимает животных"
                  />
                </div>
              </>
            ) : null}

            <div className={styles.footerActions}>
              {saved ? <span className={styles.savedNote}>Сохранено</span> : null}
              <button type="submit" className={styles.saveBtn}>
                Сохранить
              </button>
            </div>
            </form>
          </div>

          <aside className={styles.rightAside} aria-label="Подразделы профиля">
            <div className={styles.subNavCard}>
              <button
                type="button"
                className={`${styles.subNavBtn} ${section === "profile" ? styles.subNavBtnActive : ""}`}
                onClick={() => setSection("profile")}
              >
                Профиль
              </button>
              <button
                type="button"
                className={`${styles.subNavBtn} ${section === "contacts" ? styles.subNavBtnActive : ""}`}
                onClick={() => setSection("contacts")}
              >
                Контакты
              </button>
              <button
                type="button"
                className={`${styles.subNavBtn} ${section === "about" ? styles.subNavBtnActive : ""}`}
                onClick={() => setSection("about")}
              >
                О нас
              </button>
              <button
                type="button"
                className={`${styles.subNavBtn} ${section === "instructions" ? styles.subNavBtnActive : ""}`}
                onClick={() => setSection("instructions")}
              >
                Инструкции
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );

  return panel;
}
