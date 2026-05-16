"use client";

import { useEffect, useRef, useState } from "react";
import { getOrganizationCabinetEventName, getOrganizationProfile } from "@/shared/lib/organizationCabinet";
import { fetchOrganizationMeCabinetApiPayload } from "@/shared/lib/organizationMeCabinet";
import {
  emptyOrganizationCabinetApiPayload,
  fetchOrganizationCabinetApiPayload,
  type OrganizationCabinetApiPayload,
} from "@/shared/lib/organizationPublicCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

const CABINET_FETCH_TIMEOUT_MS = 35_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve("timeout"), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      () => {
        clearTimeout(id);
        resolve("timeout");
      }
    );
  });
}

export type OrganizationCabinetPayloadWithStatus = OrganizationCabinetApiPayload & {
  isFetching: boolean;
};

export function useOrganizationPublicCabinetPayload(): OrganizationCabinetPayloadWithStatus {
  const { role, userName, isLoading: userLoading } = useUser();
  const [data, setData] = useState<OrganizationCabinetApiPayload>(() => emptyOrganizationCabinetApiPayload());
  const [cabinetLoading, setCabinetLoading] = useState(true);
  const [cabinetTick, setCabinetTick] = useState(0);
  const cabinetFetchGen = useRef(0);

  useEffect(() => {
    if (role !== "organization") {
      cabinetFetchGen.current += 1;
      setCabinetLoading(false);
    }
  }, [role]);

  useEffect(() => {
    const ev = getOrganizationCabinetEventName();
    const bump = () => setCabinetTick((t) => t + 1);
    window.addEventListener(ev, bump);
    return () => window.removeEventListener(ev, bump);
  }, []);

  useEffect(() => {
    if (role !== "organization") {
      return;
    }
    const myGen = ++cabinetFetchGen.current;
    setCabinetLoading(true);
    const hints = [
      getOrganizationProfile().organizationName?.trim() || "",
      typeof window !== "undefined" ? localStorage.getItem("userName")?.trim() || "" : "",
      userName?.trim() || "",
    ].filter(Boolean);

    const isStale = () => myGen !== cabinetFetchGen.current;

    void (async () => {
      try {
        const meResult = await withTimeout(
          fetchOrganizationMeCabinetApiPayload(hints),
          CABINET_FETCH_TIMEOUT_MS
        );
        if (isStale()) return;

        if (meResult !== "timeout" && meResult) {
          setData(meResult);
          return;
        }

        const pubResult = await withTimeout(
          fetchOrganizationCabinetApiPayload(hints),
          CABINET_FETCH_TIMEOUT_MS
        );
        if (isStale()) return;

        if (pubResult !== "timeout") {
          setData(pubResult);
        } else {
          setData(emptyOrganizationCabinetApiPayload());
        }
      } catch {
        if (!isStale()) {
          setData(emptyOrganizationCabinetApiPayload());
        }
      } finally {
        if (!isStale()) {
          setCabinetLoading(false);
        }
      }
    })();
  }, [role, userName, cabinetTick]);

  if (role !== "organization") {
    return { ...emptyOrganizationCabinetApiPayload(), isFetching: userLoading };
  }

  const isFetching = cabinetLoading;

  return { ...data, isFetching };
}
