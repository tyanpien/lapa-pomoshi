"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OrganizationEditPanel } from "@/widgets/organization-edit-panel/OrganizationEditPanel";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import type { OrganizationListItem } from "@/shared/api/endpoints/organizations";
import { organizationsApi } from "@/shared/api/endpoints/organizations";
import {
  getOrganizationCabinetEventName,
  getOrganizationProfile,
  saveOrganizationProfile,
} from "@/shared/lib/organizationCabinet";
import {
  buildOrganizationCabinetProfilePatch,
  extractOrganizationIdFromCabinetPayload,
  isOrgCabinetProfileResponse,
  mapOrgCabinetProfileResponseToProfileData,
  mapOrganizationPublicPageToProfileData,
  tryParseOrganizationPublicPage,
} from "@/shared/lib/organizationMeCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

export default function OrganizationProfileEditPage() {
  const router = useRouter();
  const { role, isLoading } = useUser();
  const [profile, setProfile] = useState(() => getOrganizationProfile());
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [remoteReady, setRemoteReady] = useState(false);
  const patchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (role !== "organization") {
      setProfile(getOrganizationProfile());
      setRemoteReady(true);
      return;
    }
    let cancelled = false;
    setLoadError("");
    setRemoteReady(false);
    void (async () => {
      try {
        const raw = await meOrganizationApi.getProfileCabinet();
        if (cancelled) return;
        const orgId = extractOrganizationIdFromCabinetPayload(raw);
        const hint =
          (typeof window !== "undefined" ? localStorage.getItem("userName")?.trim() : "") || "";

        let listItem: OrganizationListItem | null = null;
        if (orgId != null) {
          try {
            const { items } = await organizationsApi.getList();
            listItem = (items ?? []).find((it) => it.id === orgId) ?? null;
          } catch {
          }
        }

        const applyMapped = (mapped: ReturnType<typeof mapOrgCabinetProfileResponseToProfileData>) => {
          setProfile(mapped);
          saveOrganizationProfile(mapped);
        };

        if (isOrgCabinetProfileResponse(raw)) {
          applyMapped(mapOrgCabinetProfileResponseToProfileData(raw as Record<string, unknown>, listItem, hint));
        } else {
          let page =
            tryParseOrganizationPublicPage(raw) ??
            (orgId != null ? await organizationsApi.getById(orgId).catch(() => null) : null);
          if (cancelled) return;
          if (!page) {
            try {
              const preview = await meOrganizationApi.getProfilePreview();
              page = tryParseOrganizationPublicPage(preview);
            } catch {
              page = null;
            }
          }
          if (cancelled) return;
          if (!page) {
            setProfile(getOrganizationProfile());
          } else {
            applyMapped(mapOrganizationPublicPageToProfileData(page, listItem, hint));
          }
        }
      } catch {
        if (!cancelled) setLoadError("Не удалось загрузить профиль с сервера.");
        setProfile(getOrganizationProfile());
      } finally {
        if (!cancelled) setRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, isLoading]);

  useEffect(() => {
    if (!remoteReady) return;
    if (patchTimer.current != null) window.clearTimeout(patchTimer.current);
    patchTimer.current = window.setTimeout(() => {
      saveOrganizationProfile(profile);
      window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
      if (role === "organization") {
        void meOrganizationApi
          .patchProfileCabinet(buildOrganizationCabinetProfilePatch(profile))
          .catch(() => {});
      }
    }, 550);
    return () => {
      if (patchTimer.current != null) window.clearTimeout(patchTimer.current);
    };
  }, [profile, remoteReady, role]);

  const handleSave = () => {
    saveOrganizationProfile(profile);
    if (role === "organization") {
      void meOrganizationApi
        .patchProfileCabinet(buildOrganizationCabinetProfilePatch(profile))
        .catch(() => {});
    }
    window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleClose = () => {
    saveOrganizationProfile(profile);
    if (role === "organization") {
      void meOrganizationApi
        .patchProfileCabinet(buildOrganizationCabinetProfilePatch(profile))
        .catch(() => {});
    }
    window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
    router.push("/organization/profile");
  };

  return (
    <>
      {loadError ? (
        <p style={{ maxWidth: 720, margin: "16px auto", color: "#a33", fontSize: 14 }}>{loadError}</p>
      ) : null}
      <OrganizationEditPanel
        open
        variant="inline"
        onClose={handleClose}
        profile={profile}
        setProfile={setProfile}
        onSave={handleSave}
        saved={saved}
      />
    </>
  );
}
