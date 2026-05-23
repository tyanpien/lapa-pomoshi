"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { animalsApi, Animal } from "@/shared/api/endpoints/animals";
import { getImageUrl } from "@/shared/api/client";
import { getOrganizationAnimalById } from "@/shared/lib/organizationAnimals";
import { useUser } from "@/shared/lib/hooks/useUser";
import { AdoptionQuestionnaireModal } from "@/features/adoption-questionnaire/AdoptionQuestionnaireModal";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { getLoginHref } from "@/shared/lib/auth/loginHref";
import { urgentApi, type UrgentItem } from "@/shared/api/endpoints/urgent";
import { helpApi, type HelpAnimalMonetary } from "@/shared/api/endpoints/help";
import { formatHelpRub } from "@/features/help-animal-card/helpAnimalCardModel";
import { HelpRequisitesModal } from "@/features/help-requisites/HelpRequisitesModal";
import { formatAgeMonthsRu } from "@/shared/lib/formatAgeMonthsRu";

const uniqueLinesPreservingOrder = (lines: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
};

export default function AnimalPage() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = Number(params.id);
  const fromHelpIntent = searchParams.get("help") === "1";

  const { isAuth, role } = useUser();
  const canApplyAdoption = isAuth && (role === "user" || role === "volunteer");

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [mainImage, setMainImage] = useState("/cat-placeholder.jpg");
  const [loading, setLoading] = useState(true);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [linkedHelpRows, setLinkedHelpRows] = useState<UrgentItem[]>([]);
  const [monetaryNeeds, setMonetaryNeeds] = useState<HelpAnimalMonetary[]>([]);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const hasPublishedHelpRequests = linkedHelpRows.length > 0 || monetaryNeeds.length > 0;
  const showHelpButton = hasPublishedHelpRequests || fromHelpIntent;

  const helpNeedText =
    uniqueLinesPreservingOrder((monetaryNeeds ?? []).map((m) => m.line).filter(Boolean)).join(" · ") ||
    linkedHelpRows[0]?.description?.trim() ||
    "Нужна помощь";

  const primaryHelpRequestId =
    monetaryNeeds.length > 0 && typeof monetaryNeeds[0].request_id === "number"
      ? monetaryNeeds[0].request_id
      : linkedHelpRows[0]?.id ?? null;

  const helpTargetAmount = useMemo(() => {
    const fromMonetary = (monetaryNeeds ?? []).reduce((sum, row) => sum + (Number(row.amount_rub) || 0), 0);
    if (fromMonetary > 0) return formatHelpRub(fromMonetary);
    const fromRequest = linkedHelpRows[0]?.target_amount;
    if (fromRequest != null && fromRequest > 0) return formatHelpRub(fromRequest);
    return null;
  }, [monetaryNeeds, linkedHelpRows]);

  useEffect(() => {
    let cancelled = false;

    const applyAnimal = (data: Animal) => {
      setAnimal(data);
      if (data.photo_urls?.length) {
        setMainImage(getImageUrl(data.photo_urls[0]));
      } else if (data.primary_photo_url) {
        setMainImage(getImageUrl(data.primary_photo_url));
      } else {
        setMainImage("/cat-placeholder.jpg");
      }
    };

    setLoading(true);
    animalsApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        applyAnimal(data as Animal);
        setLoading(false);
      })
      .catch(() => {
        const localAnimal = getOrganizationAnimalById(id);
        if (cancelled) return;
        if (localAnimal) {
          applyAnimal(localAnimal);
        } else {
          setAnimal(null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    Promise.all([
      urgentApi.getList({ limit: 400 }).catch(() => ({ items: [] as UrgentItem[] })),
      helpApi.getAnimalHelp("all").catch(() => ({ items: [] })),
    ])
      .then(([urgent, help]) => {
        if (cancelled) return;
        const st = (s: string | undefined) => String(s ?? "").toLowerCase();
        const open = (urgent.items ?? []).filter(
          (r) => r.animal_id === id && st(r.status) !== "closed" && st(r.status) !== "cancelled"
        );
        setLinkedHelpRows(open);
        const hi = (help.items ?? []).find((i) => i.animal_id === id);
        setMonetaryNeeds(hi?.monetary ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!canApplyAdoption) return;
    let cancelled = false;
    void meProfileApi
      .get()
      .then((profile) => {
        if (cancelled) return;
        setProfileName(profile.user.full_name?.trim() ?? "");
        setProfileEmail(profile.user.email?.trim() ?? "");
        setProfilePhone(profile.user.phone?.trim() ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canApplyAdoption]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = "/cat-placeholder.jpg";
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Загрузка...</h1>
        </div>
      </div>
    );
  }

  if (!animal) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h1>Животное не найдено</h1>
          <Link href="/help">Вернуться к списку</Link>
        </div>
      </div>
    );
  }

  const photoUrls = animal.photo_urls ?? [];
  const images = photoUrls.length > 0
    ? photoUrls.map((url) => getImageUrl(url))
    : animal.primary_photo_url
      ? [getImageUrl(animal.primary_photo_url)]
      : ["/cat-placeholder.jpg"];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/help">Помочь</Link>
          <span>/</span>
          <span>{animal.name}</span>
        </div>

        <div className={styles.topBlock}>
          <div className={styles.photoBlock}>
            <div className={styles.mainPhoto}>
              <img
                src={mainImage}
                alt={animal.name}
                onError={handleImageError}
              />
            </div>

            {images.length > 1 && (
              <div className={styles.thumbnails}>
                {images.map((img: string, idx: number) => (
                  <div
                    key={idx}
                    className={`${styles.thumbnail} ${
                      mainImage === img ? styles.activeThumb : ""
                    }`}
                    onClick={() => setMainImage(img)}
                  >
                    <img
                      src={img}
                      alt={`${animal.name} ${idx + 1}`}
                      onError={handleImageError}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.infoBlock}>
            <h1>{animal.name}</h1>

            <div className={styles.tags}>
              {animal.is_urgent && <span className={styles.urgentTag}>Срочно</span>}
              <span>{animal.species}</span>
              <span>{animal.breed || "Метис"}</span>
              <span>{formatAgeMonthsRu(animal.age_months)}</span>
            </div>

            <p className={styles.description}>
              {animal.full_description || "Описание отсутствует"}
            </p>

            <div className={styles.orgBlock}>
              <img src="/org.svg" className={styles.orgIcon} alt="Организация" />
              <span>
                {animal.organization?.name || "Организация не указана"}
              </span>
            </div>

            <div className={styles.actionButtons}>
              {showHelpButton ? (
                isAuth ? (
                  <button type="button" className={styles.helpBtn} onClick={() => setHelpModalOpen(true)}>
                    Помочь
                  </button>
                ) : (
                  <Link
                    href={getLoginHref(`/catalog/animals/${id}?help=1`)}
                    className={styles.helpBtn}
                  >
                    Помочь
                  </Link>
                )
              ) : null}
              {canApplyAdoption ? (
                <button type="button" className={styles.adoptBtn} onClick={() => setAdoptOpen(true)}>
                  {animal.status === "looking_for_home" ? "Забрать домой" : "Забрать на передержку"}
                </button>
              ) : !isAuth ? (
                <Link href={getLoginHref(pathname || `/catalog/animals/${id}`)} className={styles.adoptBtn}>
                  Войти, чтобы подать анкету
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Здоровье и уход</h2>

          <div className={styles.healthGrid}>
            {animal.health_checklist?.length ? (
              animal.health_checklist.map((item, idx) => (
                <div key={`${item}-${idx}`} className={styles.healthItem}>
                  <img src="/check.svg" alt="" />
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <span>Не указано</span>
            )}
          </div>
        </div>

        <div className={styles.twoColumns}>
          <div className={styles.column}>
            <h2>Особенности здоровья:</h2>
            <p className={styles.healthText}>
              {animal.health_features || "Не указано"}
            </p>
          </div>

          <div className={styles.column}>
            <h2>Требуемое лечение:</h2>
            <p className={styles.healthText}>
              {animal.treatment_required || "Не требуется"}
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Особенности характера</h2>

          <div className={styles.characterTags}>
            {animal.character_tags?.length ? (
              animal.character_tags.map((trait: string, idx: number) => (
                <span key={idx} className={styles.characterTag}>
                  {trait}
                </span>
              ))
            ) : (
              <span>Не указано</span>
            )}
          </div>
        </div>
      </div>

      {adoptOpen && animal ? (
        <AdoptionQuestionnaireModal
          animalId={animal.id}
          animalName={animal.name}
          initialName={profileName}
          initialEmail={profileEmail}
          initialPhone={profilePhone}
          onClose={() => setAdoptOpen(false)}
        />
      ) : null}

      {helpModalOpen && animal ? (
        <HelpRequisitesModal
          animalId={animal.id}
          animalName={animal.name}
          organizationName={animal.organization?.name || "Организация"}
          needText={helpNeedText}
          primaryHelpRequestId={primaryHelpRequestId}
          targetAmount={helpTargetAmount}
          onClose={() => setHelpModalOpen(false)}
        />
      ) : null}
    </main>
  );
}
