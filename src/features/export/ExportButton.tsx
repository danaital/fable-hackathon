"use client";

import { ChevronDown, Download } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { Button, Dialog, Divider, Stack } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ExportWizard } from "./ExportWizard";
import { buildPlan } from "./plan";
import { ProgressPanel } from "./ProgressPanel";
import { EXPORT_FORMATS, type ExportFormat, type ExportTemplate, type WizardState } from "./schema";
import { fileTemplates } from "./templates";
import { TemplatesDialog } from "./TemplatesDialog";
import { ICON_SIZE } from "./ui";
import { useEscapeGuard } from "./useEscapeGuard";
import { useExportRunner } from "./useExportRunner";
import { usePageContext } from "./usePageContext";
import { applyTemplate, initialState } from "./wizardState";

const MENU_MIN_WIDTH = "240px";
const MENU_LAYER = 20;

const MenuWrap = styled.div`
  position: relative;
  display: inline-flex;
`;

const MenuPanel = styled.div`
  ${({ theme: { color, radius, space } }) => css`
    position: absolute;
    inset-block-start: calc(100% + ${space.xs});
    inset-inline-start: 0;
    z-index: ${MENU_LAYER};
    display: flex;
    flex-direction: column;
    gap: ${space.xs};
    min-inline-size: ${MENU_MIN_WIDTH};
    padding: ${space.xs};
    border: 1px solid ${color.border};
    border-radius: ${radius.md};
    background: ${color.surface};
  `}
`;

const MenuItem = styled(Button)`
  justify-content: flex-start;
  inline-size: 100%;
`;

/** Export entry point of a report page: the wizard, one-click export of what is on screen, and saved templates. */
export function ExportButton() {
  const { t, locale } = useI18n();
  const page = usePageContext();
  const runner = useExportRunner();
  const [menuOpen, setMenuOpen] = useState(false);
  const [wizard, setWizard] = useState<{ templateId: string | null } | null>(null);
  const [managing, setManaging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { busy, progress } = runner;

  // The menu is a plain disclosure: Tab moves through its buttons, Escape or a click elsewhere closes it.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // Focus goes back to the Export button whenever something it opened closes.
  const closeWizard = useCallback(() => {
    setWizard(null);
    buttonRef.current?.focus();
  }, []);
  const closeProgress = () => {
    if (busy) return; // stays open while the export runs; Cancel is the way out
    runner.reset();
    buttonRef.current?.focus();
  };
  useEscapeGuard({ anchor: progressRef, active: progress !== null, onEscape: closeProgress });

  const defaults = (): WizardState =>
    initialState({ report: page.report, view: page.view, locale, charts: page.charts, fileTemplates: fileTemplates.list(), totalLabel: t("export.summary.defaultLabel") });
  /** What is on screen, straight to a file: the wizard's defaults with only the format chosen. */
  const quickExport = (format: ExportFormat) => {
    setMenuOpen(false);
    const state = { ...defaults(), format };
    void runner.start(() => buildPlan(state, page));
  };
  const exportTemplate = (template: ExportTemplate) => {
    setManaging(false);
    const base = defaults();
    const state = applyTemplate({ state: base, template, fileTemplates: fileTemplates.list(), defaults: base });
    void runner.start(() => buildPlan(state, page));
  };
  const open = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <>
      <MenuWrap
        ref={wrapRef}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !menuOpen) return;
          setMenuOpen(false);
          buttonRef.current?.focus();
        }}
      >
        <Button ref={buttonRef} aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} disabled={busy} onClick={() => setMenuOpen(!menuOpen)}>
          <Download size={ICON_SIZE} aria-hidden />
          {t("export.button")}
          <ChevronDown size={ICON_SIZE} aria-hidden />
        </Button>
        {menuOpen ? (
          <MenuPanel id={menuId} role="group" aria-label={t("export.menu")}>
            <MenuItem $variant="ghost" onClick={open(() => setWizard({ templateId: null }))}>
              {t("export.menu.wizard")}
            </MenuItem>
            {EXPORT_FORMATS.map((format) => (
              <MenuItem key={format} $variant="ghost" onClick={() => quickExport(format)}>
                {t(`export.menu.quick.${format}`)}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem $variant="ghost" onClick={open(() => setManaging(true))}>
              {t("export.menu.templates")}
            </MenuItem>
          </MenuPanel>
        ) : null}
      </MenuWrap>

      {wizard ? <ExportWizard page={page} templateId={wizard.templateId} onClose={closeWizard} /> : null}

      <TemplatesDialog
        open={managing}
        onClose={() => {
          setManaging(false);
          buttonRef.current?.focus();
        }}
        page={page}
        onExport={exportTemplate}
        onOpen={(template) => {
          setManaging(false);
          setWizard({ templateId: template.id });
        }}
      />

      <Dialog
        open={progress !== null}
        onClose={closeProgress}
        title={t("export.progress.title")}
        footer={
          <Button onClick={closeProgress} disabled={busy}>
            {t("action.close")}
          </Button>
        }
      >
        <Stack ref={progressRef}>{progress ? <ProgressPanel progress={progress} onCancel={busy ? runner.cancel : undefined} /> : null}</Stack>
      </Dialog>
    </>
  );
}
