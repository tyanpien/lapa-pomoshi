"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserProfileEditModal, type UserProfileEditInitial } from "@/features/user-profile/UserProfileEditModal";
import { useUser } from "@/shared/lib/hooks/useUser";
import { meApplicationsApi, type AdoptionApplicationListItem } from "@/shared/api/endpoints/meApplications";
import { meProfileApi, type MeProfileResponse } from "@/shared/api/endpoints/meProfile";
import { meUserCommunicationsApi } from "@/shared/api/endpoints/meUserCommunications";
import { getImageUrl } from "@/shared/api/client";
import { displayAccountEmail } from "@/shared/lib/displayAccountContact";
import type { ChatThread } from "@/shared/lib/messages";
import { unwrapApiList } from "@/shared/lib/organizationMeCabinet";
import { mapUserDialogListRow } from "@/shared/lib/userOrgDialogs";
import styles from "./page.module.css";

function profileEditInitialFromApi(prof: MeProfileResponse, displayName: string): UserProfileEditInitial {
  return {
    fullName: prof.user.full_name?.trim() || displayName,
    email: displayAccountEmail(prof.user.email),
    phone: prof.user.phone?.trim() ?? "",
    avatarUrl: resolveProfileAvatar(prof.volunteer_profile?.avatar_url, prof.user_profile?.avatar_url),
  };
}

function resolveProfileAvatar(volunteerUrl: string | null | undefined, userUrl: string | null | undefined) {
  const raw = volunteerUrl?.trim() || userUrl?.trim() || "";
  return raw ? getImageUrl(raw) : null;
}

export default function ProfilePage() {
  const { userName: hookUserName, role, isLoading: userLoading } = useUser();
  const [openedMenuId, setOpenedMenuId] = useState<number | null>(null);
  const [applications, setApplications] = useState<AdoptionApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<MeProfileResponse | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);
  const [messageThreads, setMessageThreads] = useState<ChatThread[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  const editModalInitial = useMemo((): UserProfileEditInitial => {
    if (profileSnapshot) {
      return profileEditInitialFromApi(profileSnapshot, displayName);
    }
    return {
      fullName: displayName || hookUserName || "",
      email: "",
      phone: "",
      avatarUrl: avatarSrc,
    };
  }, [profileSnapshot, displayName, hookUserName, avatarSrc]);

  const reload = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const [prof, apps] = await Promise.all([
        meProfileApi.get(),
        meApplicationsApi.list({ limit: 3 }),
      ]);
      const storedName =
        typeof window !== "undefined" ? (localStorage.getItem("userName")?.trim() ?? "") : "";
      const name =
        prof.user.full_name?.trim() ||
        prof.user.email?.trim() ||
        storedName ||
        "Профиль";
      setDisplayName(name);
      setProfileSnapshot(prof);
      setAvatarSrc(resolveProfileAvatar(prof.volunteer_profile?.avatar_url, prof.user_profile?.avatar_url));
      setApplications((apps.items ?? []).slice(0, 3));
    } catch {
      setLoadError("Не удалось загрузить данные профиля. Обновите страницу позже.");
      setApplications([]);
      const stored =
        typeof window !== "undefined" ? (localStorage.getItem("userName")?.trim() ?? "") : "";
      setDisplayName(stored || "Профиль");
      setAvatarSrc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    setMessagesLoading(true);
    void meUserCommunicationsApi
      .listDialogs()
      .then((raw) => {
        if (cancelled) return;
        const rows = unwrapApiList<Record<string, unknown>>(raw);
        setMessageThreads(rows.map((row) => mapUserDialogListRow(row)));
      })
      .catch(() => {
        if (!cancelled) setMessageThreads([]);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMenu = (formId: number) => {
    setOpenedMenuId((prevId) => (prevId === formId ? null : formId));
  };

  useEffect(() => {
    if (openedMenuId === null) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickedInsideMenu = target?.closest('[data-form-menu-root="true"]');

      if (!clickedInsideMenu) {
        setOpenedMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openedMenuId]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.userHeader}>
          <div className={styles.userHeaderMain}>
            <div className={styles.headerAvatarWrap}>
              <img
                src={avatarSrc || "/event.png"}
                alt=""
                className={styles.headerAvatarImg}
              />
            </div>
            <h1>{displayName || hookUserName || "Профиль"}</h1>
          </div>
          {role === "user" ? (
            <button
              type="button"
              className={styles.editProfileButton}
              onClick={() => setEditModalOpen(true)}
            >
              Редактировать профиль
            </button>
          ) : null}
        </section>

        {!userLoading && role === "user" ? (
          <div className={styles.volunteerCtaWrap}>
            <section className={styles.volunteerCta} aria-labelledby="become-volunteer-cta-title">
              <h2 id="become-volunteer-cta-title">Волонтёрство</h2>
              <p>
                Хотите помогать приютам и животным? Заполните расширенную анкету — откроется личный кабинет
                волонтёра и лента задач.
              </p>
              <Link href="/profile/become-volunteer" className={styles.volunteerCtaButton}>
                Стать волонтёром
              </Link>
            </section>
          </div>
        ) : null}

        <UserProfileEditModal
          open={editModalOpen}
          initial={editModalInitial}
          onClose={() => setEditModalOpen(false)}
          onSaved={({ fullName, avatarUrl }) => {
            setDisplayName(fullName);
            setAvatarSrc(avatarUrl);
            void reload();
          }}
        />

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Сообщения</h2>
            <Link href="/messages" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>
          {messagesLoading ? (
            <p className={styles.messagesPlaceholder}>Загрузка…</p>
          ) : messageThreads.length === 0 ? (
            <p className={styles.messagesPlaceholder}>
              Сообщения с организациями появятся здесь, когда приют напишет вам.
            </p>
          ) : (
            <div className={styles.messageList}>
              {messageThreads.map((thread) => (
                <div key={thread.id} className={styles.messageItem}>
                  <Link
                    href={`/messages?thread=${thread.id}`}
                    className={styles.messageItemLink}
                    aria-label={`Диалог с «${thread.title}»${thread.unread ? `, непрочитанных: ${thread.unread}` : ""}`}
                  >
                    <div className={styles.smallAvatar} aria-hidden="true">
                      {thread.avatarUrl ? (
                        <img src={thread.avatarUrl} alt="" className={styles.smallAvatarImg} />
                      ) : null}
                    </div>
                    {thread.unread && thread.unread > 0 ? (
                      <span className={styles.unread} aria-hidden="true">
                        {thread.unread > 99 ? "99+" : thread.unread}
                      </span>
                    ) : null}
                    <div className={styles.messageMeta}>
                      <p>{thread.title}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <h2>Мои анкеты</h2>
            <Link href="/profile/applications" className={styles.viewAll}>
              Смотреть все
            </Link>
          </div>

          {loadError ? <p className={styles.messagesPlaceholder}>{loadError}</p> : null}
          {loading ? <p className={styles.messagesPlaceholder}>Загрузка…</p> : null}

          <div className={styles.formsList}>
            {!loading && applications.length === 0 && !loadError ? (
              <p className={styles.messagesPlaceholder}>Пока нет заявок на пристройство.</p>
            ) : null}

            {!loading &&
              applications.map((form) => (
                <article className={styles.formCard} key={form.id}>
                  <img
                    src={meApplicationsApi.getImageUrl(form.primary_photo_url)}
                    alt={form.animal_name}
                    className={styles.formImage}
                  />
                  <div className={styles.formContent}>
                    <div className={styles.formBody}>
                      <div className={styles.formTitleRow}>
                        <h3>{form.animal_name}</h3>
                        <div className={styles.menuWrap} data-form-menu-root="true">
                          <button
                            className={styles.menuBtn}
                            aria-label="Действия с анкетой"
                            aria-expanded={openedMenuId === form.id}
                            onClick={() => toggleMenu(form.id)}
                            type="button"
                          >
                            ⋮
                          </button>
                          {openedMenuId === form.id && (
                            <div className={styles.menuDropdown}>
                              <Link
                                href={`/catalog/animals/${form.animal_id}`}
                                className={styles.menuLink}
                                onClick={() => setOpenedMenuId(null)}
                              >
                                Подробнее
                              </Link>
                              <button
                                type="button"
                                className={styles.menuDelete}
                                disabled={deleteBusyId === form.id}
                                onClick={() => {
                                  setDeleteBusyId(form.id);
                                  void meApplicationsApi
                                    .delete(form.id)
                                    .then(() => reload())
                                    .finally(() => setDeleteBusyId(null));
                                  setOpenedMenuId(null);
                                }}
                              >
                                Удалить анкету
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={styles.tags}>
                        <span>{form.species_label}</span>
                        <span>{form.breed ?? "—"}</span>
                        <span>{form.age_label}</span>
                      </div>
                      <div className={styles.formBottomRow}>
                        <div className={styles.orgAddress}>
                          <img src="/org.svg" alt="адрес" className={styles.orgIcon} />
                          <p className={styles.orgName}>{form.organization_name ?? "Организация не указана"}</p>
                        </div>
                        <span
                          className={
                            form.status === "rejected"
                              ? `${styles.status} ${styles.statusRejected}`
                              : styles.status
                          }
                        >
                          {form.status_label}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
