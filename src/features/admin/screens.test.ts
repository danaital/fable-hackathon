import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { demoSeed } from "@/features/auth/demoSeed";
import { AuthError } from "@/features/auth/model";
import { BASELINE } from "@/features/auth/permissions";
import type { Actor } from "@/features/auth/rules";
import { I18nProvider } from "@/i18n";
import type { Locale } from "@/lib/prefs";
import { lightTheme } from "@/styles/theme";
import { FieldsScreen } from "./FieldsScreen";
import { ReportDialog } from "./ReportDialog";
import { ReportsScreen } from "./ReportsScreen";
import { UserDialog } from "./UserDialog";

// Render smoke tests: each piece renders to HTML in both languages without throwing. Behaviour is covered by the logic tests.

const html = (element: ReactElement, locale: Locale = "en") =>
  renderToString(createElement(ThemeProvider, { theme: lightTheme, children: createElement(I18nProvider, { initialLocale: locale, children: element }) }));

const noop = () => undefined;
const root: Actor = { id: "demo-root", role: "super-admin", isRoot: true };
const viewer = demoSeed().users[4];
const userDialog = (request: Parameters<typeof UserDialog>[0]["request"], actor: Actor = root) =>
  createElement(UserDialog, { request, actor, roleDefaults: BASELINE, busy: false, onClose: noop, onSubmit: noop });

describe("admin screens render", () => {
  it("shows the create user form in English and Hebrew", () => {
    expect(html(userDialog({ user: null, lock: null }))).toContain("First name");
    expect(html(userDialog({ user: null, lock: null }), "he")).toContain("שם פרטי");
  });

  it("shows why a locked row cannot be edited and disables its controls", () => {
    const out = html(userDialog({ user: viewer, lock: new AuthError("rootProtected") }));
    expect(out).toContain("The root administrator account can&#x27;t be changed by anyone else.");
    expect(out.match(/<input[^>]*disabled/g)).toHaveLength(4);
  });

  it("offers the top level only to the root administrator", () => {
    const topOption = (actor: Actor) => html(userDialog({ user: null, lock: null }, actor)).match(/<option[^>]*value="super-admin"[^>]*>/)?.[0];
    expect(topOption(root)).not.toContain("disabled");
    expect(topOption({ ...root, isRoot: false })).toContain("disabled");
  });

  it("renders user-entered text as text, never as markup", () => {
    const out = html(userDialog({ user: { ...viewer, firstName: "<img src=x onerror=alert(1)>", lastName: "" }, lock: null }));
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("lists the built-in reports and the create report form", () => {
    const list = html(createElement(ReportsScreen));
    for (const id of ["orders", "customers", "invoices", "shipments", "tickets", "products"]) expect(list).toContain(`>${id}<`);
    expect(html(createElement(ReportDialog, { request: { report: null }, onClose: noop }), "he")).toContain("מאגר נתונים");
  });

  it("opens the fields of the report named in the address, and the first report for anything unknown", () => {
    expect(html(createElement(FieldsScreen, { initialReport: "customers" }))).toContain(">customerId<");
    const unknown = html(createElement(FieldsScreen, { initialReport: "<script>alert(1)</script>" }));
    expect(unknown).toContain(">orderId<");
    expect(unknown).not.toContain("<script>");
  });
});
