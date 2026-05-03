"use client";

import { useEffect, useState } from "react";
import { getOrganizationCabinetEventName, getOrganizationProfile } from "@/shared/lib/organizationCabinet";
import {
  emptyOrganizationCabinetApiPayload,
  fetchOrganizationCabinetApiPayload,
  type OrganizationCabinetApiPayload,
} from "@/shared/lib/organizationPublicCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

export function useOrganizationPublicCabinetPayload(): OrganizationCabinetApiPayload {
  const { role, userName } = useUser();
  const [data, setData] = useState<OrganizationCabinetApiPayload>(emptyOrganizationCabinetApiPayload);
  const [cabinetTick, setCabinetTick] = useState(0);

  useEffect(() => {
    const ev = getOrganizationCabinetEventName();
    const bump = () => setCabinetTick((t) => t + 1);
    window.addEventListener(ev, bump);
    return () => window.removeEventListener(ev, bump);
  }, []);

  useEffect(() => {
    if (role !== "organization") return;
    let cancelled = false;
    const hints = [
      getOrganizationProfile().organizationName?.trim() || "",
      typeof window !== "undefined" ? localStorage.getItem("userName")?.trim() || "" : "",
      userName?.trim() || "",
    ].filter(Boolean);
    fetchOrganizationCabinetApiPayload(hints).then((next) => {
      if (!cancelled) setData(next);
    });
    return () => {
      cancelled = true;
    };
  }, [role, userName, cabinetTick]);

  if (role !== "organization") {
    return emptyOrganizationCabinetApiPayload();
  }
  return data;
}
