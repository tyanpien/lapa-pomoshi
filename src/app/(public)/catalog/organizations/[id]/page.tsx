"use client";

import { useParams } from "next/navigation";
import { OrganizationCatalogView } from "@/widgets/organization-catalog-view/OrganizationCatalogView";

export default function OrganizationPage() {
  const params = useParams<{ id: string }>();
  const organizationId = Number(params?.id);
  return <OrganizationCatalogView variant="public" organizationId={organizationId} />;
}
