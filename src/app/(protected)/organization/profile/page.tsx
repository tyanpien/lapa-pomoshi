"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrganizationCatalogView } from "@/widgets/organization-catalog-view/OrganizationCatalogView";
import {
  getOrganizationCabinetEventName,
  getOrganizationProfile,
} from "@/shared/lib/organizationCabinet";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

export default function OrganizationProfilePage() {
  const cabinetPayload = useOrganizationPublicCabinetPayload();
  const router = useRouter();
  const [profile, setProfile] = useState(getOrganizationProfile());

  useEffect(() => {
    const cabinetEvent = getOrganizationCabinetEventName();
    const sync = () => setProfile(getOrganizationProfile());
    sync();
    window.addEventListener(cabinetEvent, sync);
    return () => window.removeEventListener(cabinetEvent, sync);
  }, []);

  return (
    <>
      <OrganizationCatalogView
        variant="cabinet"
        cabinetPayload={cabinetPayload}
        onEditPage={() => router.push("/organization/profile/edit")}
      />
    </>
  );
}
