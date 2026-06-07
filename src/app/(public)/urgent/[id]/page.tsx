"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolveUrgentAnimalId, resolveUrgentHelpHref, resolveUrgentHelpPath } from "@/shared/lib/urgentHelpHref";
import { useUser } from "@/shared/lib/hooks/useUser";
import { HelpRequisitesModal } from "@/features/help-requisites/HelpRequisitesModal";
import { formatHelpRub } from "@/features/help-animal-card/helpAnimalCardModel";
import styles from "./page.module.css";
import { urgentApi, UrgentItem } from "@/shared/api/endpoints/urgent";
import { ANIMAL_PLACEHOLDER_SRC, getImageUrl, onAnimalImageError } from "@/shared/api/client";
import { getUrgentHelpTypeLabel } from "@/shared/lib/urgentHelpTypeLabels";
import { formatUrgentAnimalSpeciesLabel } from "@/shared/lib/animalSpeciesLabels";
import { parseUrgentDescription } from "@/shared/lib/urgentDescriptionBlocks";
import { formatRub } from "@/shared/lib/formatRub";

export default function AnimalPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const fromHelpIntent = searchParams.get("help") === "1";
  const { isAuth } = useUser();

  const [data, setData] = useState<UrgentItem | null>(null);
  const [mainImage, setMainImage] = useState(ANIMAL_PLACEHOLDER_SRC);
  const [loading, setLoading] = useState(true);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const linkedAnimalId = useMemo(
    () => (data ? resolveUrgentAnimalId(data) : null),
    [data]
  );

  useEffect(() => {
    urgentApi.getById(id)
      .then((res) => {
        setData(res);

        if (res.primary_photo_url) {
          setMainImage(getImageUrl(res.primary_photo_url));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!fromHelpIntent || loading || !data || linkedAnimalId != null || !isAuth) return;
    setHelpModalOpen(true);
  }, [fromHelpIntent, loading, data, linkedAnimalId, isAuth]);

  const handleHelpClick = () => {
    if (!data) return;
    const helpPath = resolveUrgentHelpPath(data);
    if (!isAuth) {
      router.push(resolveUrgentHelpHref(data, { loginReturnPath: pathname || `/urgent/${id}` }));
      return;
    }
    if (linkedAnimalId != null) {
      router.push(helpPath);
      return;
    }
    setHelpModalOpen(true);
  };

  const handleImageError = onAnimalImageError;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Загрузка...</h1>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Карточка не найдена</h1>
          <Link href="/urgent">Вернуться назад</Link>
        </div>
      </div>
    );
  }

  const collectionProgressPercent =
    data.target_amount != null && data.target_amount > 0
      ? (() => {
          const raw = data.collected_amount;
          const collected =
            raw == null || !Number.isFinite(Number(raw)) ? 0 : Number(raw);
          return Math.min(100, Math.round((collected / data.target_amount) * 100));
        })()
      : null;

  const speciesLabel = formatUrgentAnimalSpeciesLabel(data.animal_species);

  return (
    <main className={styles.page}>
      <div className={styles.container}>

        <div className={styles.breadcrumbs}>
          <Link href="/urgent">Срочная помощь</Link>
          <span>/</span>
          <span>{data.title}</span>
        </div>

        <div className={styles.topBlock}>

          <div className={styles.photoBlock}>
            <div className={styles.mainPhoto}>
              <img
                src={mainImage}
                alt={data.title}
                onError={handleImageError}
              />
            </div>
          </div>

          <div className={styles.infoBlock}>
            <h1>{data.title}</h1>

            <div className={styles.tags}>
              {data.is_urgent && (
                <span className={styles.urgentTag}>Срочно</span>
              )}

              {speciesLabel ? <span>{speciesLabel}</span> : null}
              <span>{getUrgentHelpTypeLabel(data.help_type)}</span>
              <span>{data.city}</span>
            </div>

            <div className={styles.descriptionWrap}>
              {parseUrgentDescription(data.description).map((block, i) => {
                if (block.type === "paragraph") {
                  return (
                    <p key={i} className={styles.description}>
                      {block.text}
                    </p>
                  );
                }
                if (block.type === "routeList") {
                  return (
                    <div key={i} className={styles.descriptionRouteBlock}>
                      <p className={styles.descriptionRouteTitle}>Маршрут:</p>
                      <ul className={styles.descriptionList}>
                        {block.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                return (
                  <p key={i} className={styles.description}>
                    <strong>{block.label}</strong> {block.body}
                  </p>
                );
              })}
            </div>

            <div className={styles.orgBlock}>
              <img src="/org.svg" className={styles.orgIcon} alt="" />
              <span>{data.organization_name}</span>
            </div>

            {collectionProgressPercent !== null && (
              <div className={styles.progressBlock}>
                <div className={styles.progressBar}>
                  <div style={{ width: `${collectionProgressPercent}%` }} />
                </div>
                <span>{formatRub(data.target_amount)}</span>
              </div>
            )}

            <div className={styles.actionButtons}>
              <button type="button" className={styles.helpBtn} onClick={handleHelpClick}>
                Помочь
              </button>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Место</h2>
          <p className={styles.healthText}>
            {data.city}
          </p>
        </div>

        <div className={styles.section}>
          <h2>Срок</h2>
          <p className={styles.healthText}>
            {data.deadline_label}
          </p>
        </div>

        <div className={styles.section}>
          <h2>Метки</h2>

          <div className={styles.characterTags}>
            {data.badges?.length ? (
              data.badges.map((b, i) => (
                <span key={i} className={styles.characterTag}>
                  {b}
                </span>
              ))
            ) : (
              <span>Нет</span>
            )}
          </div>
        </div>

      </div>

      {helpModalOpen && data && linkedAnimalId == null ? (
        <HelpRequisitesModal
          organizationId={data.organization_id ?? null}
          animalName={data.animal_name?.trim() || data.title}
          organizationName={data.organization_name}
          needText={data.description?.trim() || "Нужна помощь"}
          primaryHelpRequestId={data.id}
          targetAmount={
            data.target_amount != null && data.target_amount > 0
              ? formatHelpRub(data.target_amount)
              : null
          }
          onClose={() => setHelpModalOpen(false)}
        />
      ) : null}
    </main>
  );
}
