import { createElement, type ComponentType, type ReactNode } from "react";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";
import { BUILT_IN_MESSAGES, I18nProvider, type I18nKey } from "@/i18n";
import { LOCALES } from "@/lib/prefs";
import { lightTheme } from "@/styles/theme";
import { EntitiesScreen } from "./EntitiesScreen";
import { ImportExportScreen } from "./ImportExportScreen";
import { RelationshipsScreen } from "./RelationshipsScreen";
import { ReportEntitiesScreen } from "./ReportEntitiesScreen";
import { TranslationsScreen } from "./TranslationsScreen";
import { VersionsScreen } from "./VersionsScreen";

// Smoke test: every admin tools screen renders to markup in both languages, with its seeded rows and no untranslated key.
// The role gate is replaced by a pass-through (it has its own tests); on the server it would only show "checking".
vi.mock("@/features/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth")>()),
  RequireRole: ({ children }: { children: ReactNode }) => children,
}));

/** Screen, its title key, and a seeded value its table must show. */
const SCREENS: [ComponentType, I18nKey, string][] = [
  [ImportExportScreen, "adminTools.importExport.title", "orders"],
  [TranslationsScreen, "adminTools.translations.title", "about.title"],
  [VersionsScreen, "adminTools.versions.title", "0.1.0"],
  [EntitiesScreen, "adminTools.entities.title", "customers"],
  [RelationshipsScreen, "adminTools.relationships.title", "LEFT"],
  [ReportEntitiesScreen, "adminTools.reportEntities.title", "customer"],
];

describe("admin tools screens", () => {
  for (const locale of LOCALES) {
    for (const [Screen, titleKey, seeded] of SCREENS) {
      it(`${titleKey} renders in ${locale}`, () => {
        const html = renderToStaticMarkup(createElement(ThemeProvider, { theme: lightTheme }, jsx(I18nProvider, { initialLocale: locale, children: createElement(Screen) })));
        expect(html).toContain(BUILT_IN_MESSAGES[locale][titleKey]);
        expect(html).toContain(seeded);
        expect(html).not.toMatch(/adminTools\.[A-Za-z]/);
      });
    }
  }
});
