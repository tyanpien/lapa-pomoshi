"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { VolunteerOnboardingForm } from "@/features/volunteer-onboarding/VolunteerOnboardingForm";
import { useVolunteerProfileCatalogs } from "@/features/volunteer-onboarding/useVolunteerProfileCatalogs";
import { validateVolunteerOnboarding } from "@/features/volunteer-onboarding/validateVolunteerOnboarding";
import { mapBackendRoleToApp } from "@/features/auth/api/login";
import { authHintKey } from "@/shared/lib/auth/contactCredential";
import { getImageUrl } from "@/shared/api/client";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { applyCityGeocodeToVolunteerPatch } from "@/shared/lib/geocodeCity";
import { useUser, USER_EMAIL_STORAGE_KEY } from "@/shared/lib/hooks/useUser";
import {
  storedDetailsToVolunteerPatch,
  syncCompetencyLabelsWithCatalog,
  volunteerApiToStoredDetails,
} from "@/shared/lib/volunteerMeProfileMap";
import {
  emptyVolunteerDetails,
  notifyVolunteerProfileUpdated,
  syncVolunteerCatalogUserId,
  volunteerProfileStorageIdentity,
  writeVolunteerDetailsToStorage,
  type StoredVolunteerDetails,
} from "@/shared/lib/volunteerProfileStorage";
import styles from "./page.module.css";

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === "string") {
      return detail[0].msg;
    }
  }
  return error instanceof Error ? error.message : "Не удалось сохранить анкету.";
}

export default function BecomeVolunteerPage() {
  const router = useRouter();
  const { role, isLoading: userLoading, setUserRole, userEmail, userName } = useUser();
  const profileIdentity = useMemo(
    () => volunteerProfileStorageIdentity(userEmail, userName),
    [userEmail, userName],
  );

  const catalogs = useVolunteerProfileCatalogs();
  const [details, setDetails] = useState<StoredVolunteerDetails>(emptyVolunteerDetails);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (role === "volunteer") {
      router.replace("/volunteer/tasks");
    } else if (role === "organization") {
      router.replace("/organization/profile");
    } else if (role === "guest") {
      router.replace("/login?from=/profile/become-volunteer");
    }
  }, [role, userLoading, router]);

  const handleSubmit = async () => {
    if (!catalogs.catalogsReady) {
      setSubmitError("Справочники ещё загружаются, подождите секунду.");
      return;
    }

    const validationError = validateVolunteerOnboarding(
      details,
      catalogs.competencyCatalogRows,
      catalogs.experienceCatalogRows,
    );
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    let patch = storedDetailsToVolunteerPatch(details, {
      competencyCatalog: catalogs.competencyCatalogRows,
      experienceCatalog: catalogs.experienceCatalogRows,
    });

    const competency_slugs = patch.competency_slugs ?? [];
    const location_city = details.location.trim();

    patch = await applyCityGeocodeToVolunteerPatch(patch, location_city);

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await meProfileApi.becomeVolunteer({
        ...patch,
        competency_slugs,
        location_city,
      });

      if (res.volunteer_profile && profileIdentity.trim()) {
        const mapped = volunteerApiToStoredDetails(
          res.volunteer_profile,
          catalogs.experienceCatalogRows,
        );
        const synced: StoredVolunteerDetails = {
          ...mapped,
          competencies: syncCompetencyLabelsWithCatalog(mapped.competencies, catalogs.competencyCatalogRows),
        };
        writeVolunteerDetailsToStorage(profileIdentity, synced);
      }

      const displayName = res.user.full_name?.trim() || userName || undefined;
      const avatarRaw = res.volunteer_profile?.avatar_url?.trim() ?? "";
      const avatarForStorage = avatarRaw ? getImageUrl(avatarRaw) : undefined;
      setUserRole("volunteer", avatarForStorage, displayName);

      const email = res.user.email?.trim() || userEmail?.trim();
      if (email) {
        localStorage.setItem(`auth_role_hint:${authHintKey(email)}`, "volunteer");
        localStorage.setItem(USER_EMAIL_STORAGE_KEY, email);
      }

      await syncVolunteerCatalogUserId(profileIdentity, { userId: res.user.id });
      notifyVolunteerProfileUpdated();

      if (mapBackendRoleToApp(res.user.role) !== "volunteer") {
        setSubmitError("Роль на сервере не обновилась. Обновите страницу или войдите снова.");
        return;
      }

      router.replace("/volunteer/tasks");
      router.refresh();
    } catch (e) {
      setSubmitError(getApiErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading || role === "volunteer" || role === "organization" || role === "guest") {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p className={styles.loading}>Загрузка…</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/profile" className={styles.backLink}>
          ← Вернуться в профиль
        </Link>

        <header className={styles.header}>
          <h1>Стать волонтёром</h1>
          <p className={styles.lead}>
            Заполните анкету: компетенции, опыт, локацию и доступность. После сохранения откроются личный
            кабинет волонтёра и лента задач.
          </p>
        </header>

        <section className={styles.card} aria-labelledby="become-volunteer-form-title">
          <h2 id="become-volunteer-form-title" className={styles.visuallyHidden}>
            Анкета волонтёра
          </h2>

          {catalogs.loading ? <p className={styles.loading}>Загрузка справочников…</p> : null}
          {catalogs.error ? <p className={styles.error}>{catalogs.error}</p> : null}

          {!catalogs.loading && !catalogs.error ? (
            <VolunteerOnboardingForm
              details={details}
              setDetails={setDetails}
              competencyOptions={catalogs.competencyOptions}
              experienceOptions={catalogs.experienceOptions}
              helpFormatOptions={catalogs.helpFormatOptions}
              submitError={submitError}
              isSubmitting={isSubmitting}
              onSubmit={() => void handleSubmit()}
              onCancel={() => router.push("/profile")}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
