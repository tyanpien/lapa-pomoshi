"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdoptionQuestionnaireModal } from "@/features/adoption-questionnaire/AdoptionQuestionnaireModal";
import { mapAdoptionApiBodyToQuestionnaireForm } from "@/features/adoption-questionnaire/formatMessage";
import styles from "./page.module.css";
import { meApplicationsApi, type AdoptionApplicationListItem } from "@/shared/api/endpoints/meApplications";

export default function UserApplicationsPage() {
  const [openedMenuId, setOpenedMenuId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<AdoptionApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [editTarget, setEditTarget] = useState<{
    applicationId: number;
    animalId: number;
    animalName: string;
    initialForm: ReturnType<typeof mapAdoptionApiBodyToQuestionnaireForm>;
  } | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);

  const reload = () => {
    setLoading(true);
    setErrorText("");
    void meApplicationsApi
      .list({ q: searchQuery.trim() || undefined, limit: 100 })
      .then((res) => setItems(res.items ?? []))
      .catch(() => setErrorText("Не удалось загрузить анкеты."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) => item.animal_name.toLowerCase().includes(normalizedQuery));
  }, [items, searchQuery]);

  useEffect(() => {
    if (openedMenuId === null) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickedInsideMenu = target?.closest('[data-card-menu-root="true"]');
      if (!clickedInsideMenu) {
        setOpenedMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openedMenuId]);

  const openEdit = (row: AdoptionApplicationListItem) => {
    void meApplicationsApi.getById(row.id).then((detail) => {
      setEditTarget({
        applicationId: row.id,
        animalId: row.animal_id,
        animalName: row.animal_name,
        initialForm: mapAdoptionApiBodyToQuestionnaireForm(detail),
      });
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.headerRow}>
          <h1>Мои анкеты</h1>
          <label className={styles.searchLabel}>
            <span className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              placeholder="Найти"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") reload();
              }}
            />
          </label>
        </section>

        {errorText ? <p>{errorText}</p> : null}
        {loading ? <p>Загрузка…</p> : null}

        <section className={styles.list}>
          {filteredApplications.map((item) => (
            <article className={styles.card} key={item.id}>
              <img
                src={meApplicationsApi.getImageUrl(item.primary_photo_url)}
                alt={item.animal_name}
                className={styles.cardImage}
              />

              <div className={styles.cardContent}>
                <div className={styles.cardTop}>
                  <div>
                    <h2>{item.animal_name}</h2>
                    <div className={styles.tags}>
                      <span>{item.species_label}</span>
                      <span>{item.breed ?? "—"}</span>
                      <span>{item.age_label}</span>
                    </div>
                  </div>

                  <div className={styles.menuWrap} data-card-menu-root="true">
                    <button
                      type="button"
                      className={styles.menuBtn}
                      aria-label="Действия с анкетой"
                      aria-expanded={openedMenuId === item.id}
                      onClick={() => setOpenedMenuId((prev) => (prev === item.id ? null : item.id))}
                    >
                      ⋮
                    </button>

                    {openedMenuId === item.id ? (
                      <div className={styles.menuDropdown}>
                        <Link href={`/catalog/animals/${item.animal_id}`} className={styles.menuLink}>
                          Подробнее
                        </Link>
                        {item.status === "pending_review" ? (
                          <button
                            type="button"
                            className={styles.menuLink}
                            onClick={() => {
                              setOpenedMenuId(null);
                              openEdit(item);
                            }}
                          >
                            Редактировать
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.menuDelete}
                          disabled={deleteBusyId === item.id}
                          onClick={() => {
                            setDeleteBusyId(item.id);
                            void meApplicationsApi
                              .delete(item.id)
                              .then(() => reload())
                              .finally(() => setDeleteBusyId(null));
                          }}
                        >
                          Удалить анкету
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={styles.cardBottom}>
                  <div className={styles.organization}>
                    <img src="/org.svg" alt="" aria-hidden="true" />
                    <p>{item.organization_name ?? "Организация"}</p>
                  </div>
                  <span
                    className={
                      item.status === "rejected"
                        ? `${styles.status} ${styles.statusRejected}`
                        : styles.status
                    }
                  >
                    {item.status_label}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>

      {editTarget ? (
        <AdoptionQuestionnaireModal
          animalId={editTarget.animalId}
          animalName={editTarget.animalName}
          applicationId={editTarget.applicationId}
          initialForm={editTarget.initialForm}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            reload();
          }}
        />
      ) : null}
    </main>
  );
}
