"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrganizationEditPanel } from "@/widgets/organization-edit-panel/OrganizationEditPanel";
import { getOrganizationProfile, saveOrganizationProfile } from "@/shared/lib/organizationCabinet";

export default function OrganizationProfileEditPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(getOrganizationProfile());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(getOrganizationProfile());
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      saveOrganizationProfile(profile);
    }, 450);
    return () => window.clearTimeout(id);
  }, [profile]);

  const handleSave = () => {
    saveOrganizationProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClose = () => {
    saveOrganizationProfile(profile);
    router.push("/organization/profile");
  };

  return (
    <OrganizationEditPanel
      open
      variant="inline"
      onClose={handleClose}
      profile={profile}
      setProfile={setProfile}
      onSave={handleSave}
      saved={saved}
    />
  );
}

