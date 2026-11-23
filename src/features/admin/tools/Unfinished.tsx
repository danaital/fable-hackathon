"use client";

import { Notice } from "@/components/ui";
import { useI18n, type I18nKey } from "@/i18n";
import { AdminPage } from "./ui";

export const ADMIN_TOOL_SCREENS = ["importExport", "entities", "relationships", "reportEntities", "translations", "versions"] as const;
export type AdminToolScreen = (typeof ADMIN_TOOL_SCREENS)[number];

const TEXT: Record<AdminToolScreen, { title: I18nKey; desc: I18nKey }> = {
  importExport: { title: "adminTools.importExport.title", desc: "adminTools.importExport.desc" },
  entities: { title: "adminTools.entities.title", desc: "adminTools.entities.desc" },
  relationships: { title: "adminTools.relationships.title", desc: "adminTools.relationships.desc" },
  reportEntities: { title: "adminTools.reportEntities.title", desc: "adminTools.reportEntities.desc" },
  translations: { title: "adminTools.translations.title", desc: "adminTools.translations.desc" },
  versions: { title: "adminTools.versions.title", desc: "adminTools.versions.desc" },
};

/** Role-gated page shell for a screen whose controls are not built yet. It says so instead of showing mock data. */
export function Unfinished({ screen }: { screen: AdminToolScreen }) {
  const { t } = useI18n();
  return (
    <AdminPage min="super-admin" title={t(TEXT[screen].title)} description={t(TEXT[screen].desc)}>
      <Notice $tone="info" role="status">
        {t("adminTools.unfinished")}
      </Notice>
    </AdminPage>
  );
}
