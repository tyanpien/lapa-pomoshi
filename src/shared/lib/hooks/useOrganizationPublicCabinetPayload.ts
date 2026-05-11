"use client";

import { useEffect, useState } from "react";
import { getOrganizationCabinetEventName, getOrganizationProfile } from "@/shared/lib/organizationCabinet";
import {
  emptyOrganizationCabinetApiPayload,
  fetchOrganizationCabinetApiPayload,
  type OrganizationCabinetApiPayload,
} from "@/shared/lib/organizationPublicCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

export type OrganizationCabinetPayloadWithStatus = OrganizationCabinetApiPayload & {
  isFetching: boolean;
};

export function useOrganizationPublicCabinetPayload(): OrganizationCabinetPayloadWithStatus {
  const { role, userName, isLoading: userLoading } = useUser();
  const [data, setData] = useState<OrganizationCabinetApiPayload>(() => emptyOrganizationCabinetApiPayload());
  const [cabinetLoading, setCabinetLoading] = useState(false);
  const [cabinetTick, setCabinetTick] = useState(0);

  useEffect(() => {
    const ev = getOrganizationCabinetEventName();
    const bump = () => setCabinetTick((t) => t + 1);
    window.addEventListener(ev, bump);
    return () => window.removeEventListener(ev, bump);
  }, []);

  useEffect(() => {
    if (role !== "organization") {
      setData(emptyOrganizationCabinetApiPayload());
      setCabinetLoading(false);
      return;
    }
    let cancelled = false;
    const hints = [
      getOrganizationProfile().organizationName?.trim() || "",
      typeof window !== "undefined" ? localStorage.getItem("userName")?.trim() || "" : "",
      userName?.trim() || "",
    ].filter(Boolean);

    setCabinetLoading(true);
    fetchOrganizationCabinetApiPayload(hints).then((next) => {
      if (!cancelled) {
        setData(next);
        setCabinetLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [role, userName, cabinetTick]);

  if (role !== "organization") {
    return { ...emptyOrganizationCabinetApiPayload(), isFetching: false };
  }

  const isFetching = userLoading || cabinetLoading;

  return { ...data, isFetching };
}
