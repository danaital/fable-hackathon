"use client";

import { CircleAlert, Save, Settings2, Undo2 } from "lucide-react";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Badge, Button, Dialog, Label, Select, Stack, Text, VisuallyHidden } from "@/components/ui";
import { useReport } from "@/features/report/ReportContext";
import { defaultViewState, type ViewState } from "@/features/report/viewState";
import { useI18n, type I18nKey } from "@/i18n";
import { VIEW_GROUPS, groupViews, isDirty, resolveInitialView, type ViewGroup } from "./logic";
import { REPORT_PARAM, VIEW_PARAM, hydrateState, snapshotState, type StoredView, type ViewEntry } from "./model";
import { ButtonLink, OptGroup, Option, StarIcon } from "./parts";
import { viewsRepository } from "./repository";
import { useViews } from "./useViews";
import { ViewFormDialog, type ViewFormRequest } from "./ViewFormDialog";

const ICON_SIZE = 16;
/** Select value of the "no saved view" option. */
const NO_VIEW = "";
const GROUP_LABELS: Record<ViewGroup, I18nKey> = {
  default: "views.group.default",
  system: "views.group.system",
  favorites: "views.group.favorites",
  custom: "views.group.custom",
};

interface Announcement {
  key: I18nKey;
  name: string;
}

/** Something that would drop unsaved changes: switching to another view (`viewId`), or leaving for the views page. */
type Leaving = { to: "view"; viewId: string } | { to: "manage" };

/** A view never carries a search term: whatever is typed in the search box stays when a view is applied. */
const withSearch = (next: ViewState, live: ViewState): ViewState => ({ ...next, search: live.search });

/** Report header slot: pick a view, see and revert unsaved changes, save, save as, and go to the views page. */
export function ViewBar() {
  // useSearchParams needs a Suspense boundary so a prerendered page does not bail out to client rendering.
  return (
    <Suspense fallback={null}>
      <ViewBarContent />
    </Suspense>
  );
}

function ViewBarContent() {
  const { t } = useI18n();
  const router = useRouter();
  const { report, view, setView } = useReport();
  const { views: allViews, defaults, lastUsed, favorites } = useViews();
  const targetId = useSearchParams().get(VIEW_PARAM);
  const selectId = useId();

  const views = useMemo(() => allViews.filter((entry) => entry.reportId === report.id), [allViews, report.id]);
  const defaultId = defaults[report.id] ?? null;

  // Decided once, when the report opens: the navigation target is not applied again on later renders.
  const [opening] = useState(() => ({
    ...resolveInitialView({ views, targetId, defaultId, lastUsedId: lastUsed[report.id] }),
    targetId,
  }));
  const [currentId, setCurrentId] = useState<string | null>(opening.view?.id ?? null);
  // `leaving` waits for the user's answer; `resume` is carried out once the save dialog has saved.
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [resume, setResume] = useState<Leaving | null>(null);
  const [request, setRequest] = useState<ViewFormRequest | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const opened = useRef(false);

  // Layout effect: the opening view is on screen before the first paint, so "unsaved changes" never flashes.
  useLayoutEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const { view: first, staleDefault } = opening;
    if (first) setView((live) => withSearch(hydrateState(report, first.state), live));
    if (staleDefault) viewsRepository.setDefault(report.id, null);
    if (!opening.targetId) return;
    if (first?.id === opening.targetId) viewsRepository.setLastUsed(report.id, first.id);
    // The target is used once: drop it from the address so a reload follows the normal order.
    window.history.replaceState(null, "", window.location.pathname);
  }, [opening, report, setView]);

  const current = views.find((entry) => entry.id === currentId) ?? null;
  const baseline = useMemo(() => (current ? hydrateState(report, current.state) : defaultViewState(report)), [current, report]);
  const dirty = isDirty(view, baseline);
  const groups = groupViews({ views, defaultId, favorites });
  const isFavorite = current !== null && favorites.has(current.id);
  const manageHref = `/views?${REPORT_PARAM}=${encodeURIComponent(report.id)}`;
  const findView = (id: string) => views.find((entry) => entry.id === id) ?? null;
  const leavingFor = leaving?.to === "view" ? findView(leaving.viewId) : null;

  const apply = (next: ViewEntry | null) => {
    setCurrentId(next?.id ?? null);
    setView((live) => withSearch(next ? hydrateState(report, next.state) : defaultViewState(report), live));
    if (!next) return setAnnouncement(null);
    viewsRepository.setLastUsed(report.id, next.id);
    setAnnouncement({ key: "views.bar.applied", name: next.name });
  };

  const carryOut = (action: Leaving) => {
    if (action.to === "manage") router.push(manageHref);
    else apply(findView(action.viewId));
  };

  // Unsaved changes are never dropped silently: ask first.
  const leave = (action: Leaving) => {
    if (dirty) setLeaving(action);
    else carryOut(action);
  };

  const openSave = () =>
    setRequest(
      current && !current.system
        ? { mode: "update", report, state: snapshotState(view), source: current }
        : { mode: "create", report, state: snapshotState(view) },
    );

  const answer = {
    stay: () => setLeaving(null),
    discard: () => {
      if (leaving) carryOut(leaving);
      setLeaving(null);
    },
    save: () => {
      setResume(leaving);
      setLeaving(null);
      openSave();
    },
  };

  const onSaved = (saved: StoredView) => {
    setRequest(null);
    setCurrentId(saved.id);
    viewsRepository.setLastUsed(report.id, saved.id);
    setAnnouncement({ key: "views.bar.saved", name: saved.name });
    if (resume) carryOut(resume);
    setResume(null);
  };

  const closeSave = () => {
    setRequest(null);
    setResume(null);
  };

  const onManage = (event: MouseEvent) => {
    if (!dirty) return;
    event.preventDefault();
    setLeaving({ to: "manage" });
  };

  const optionLabel = (entry: ViewEntry, group: ViewGroup) =>
    group === "default" && entry.system ? t("views.bar.systemDefault", { name: entry.name }) : entry.name;

  return (
    <Stack $row $wrap $gap="sm">
      <Label htmlFor={selectId}>
        {t("views.bar.label")}
        <Select id={selectId} value={current?.id ?? NO_VIEW} onChange={(event) => leave({ to: "view", viewId: event.target.value })}>
          <Option value={NO_VIEW}>{t("views.bar.noView")}</Option>
          {VIEW_GROUPS.filter((group) => groups[group].length > 0).map((group) => (
            <OptGroup key={group} label={t(GROUP_LABELS[group])}>
              {groups[group].map((entry) => (
                <Option key={entry.id} value={entry.id}>
                  {optionLabel(entry, group)}
                </Option>
              ))}
            </OptGroup>
          ))}
        </Select>
      </Label>

      <Stack $row $gap="sm" role="status">
        {dirty ? (
          <Badge $tone="warning">
            <CircleAlert size={ICON_SIZE} aria-hidden />
            {t("views.bar.modified")}
          </Badge>
        ) : null}
        {!dirty && announcement ? <VisuallyHidden>{t(announcement.key, { name: announcement.name })}</VisuallyHidden> : null}
      </Stack>
      {dirty ? (
        <Button onClick={() => setView((live) => withSearch(baseline, live))}>
          <Undo2 size={ICON_SIZE} aria-hidden />
          {t("views.bar.revert")}
        </Button>
      ) : null}

      <Button
        disabled={!current || current.system}
        title={current?.system ? t("views.bar.systemLocked") : undefined}
        onClick={openSave}
      >
        <Save size={ICON_SIZE} aria-hidden />
        {t("action.save")}
      </Button>
      <Button onClick={() => setRequest({ mode: "create", report, state: snapshotState(view) })}>{t("views.bar.saveAs")}</Button>
      <Button
        $icon
        disabled={!current}
        aria-pressed={isFavorite}
        aria-label={t(isFavorite ? "views.favorite.remove" : "views.favorite.add", { name: current?.name ?? "" })}
        onClick={() => current && viewsRepository.toggleFavorite(current.id)}
      >
        <StarIcon $on={isFavorite} size={ICON_SIZE} aria-hidden />
      </Button>
      <ButtonLink as={NextLink} href={manageHref} onClick={onManage}>
        <Settings2 size={ICON_SIZE} aria-hidden />
        {t("views.bar.manage")}
      </ButtonLink>

      <ViewFormDialog request={request} onClose={closeSave} onSaved={onSaved} />
      <Dialog
        open={leaving !== null}
        onClose={answer.stay}
        title={t("views.discard.title")}
        footer={
          <>
            <Button onClick={answer.stay}>{t("views.discard.stay")}</Button>
            <Button onClick={answer.discard}>{t("views.discard.confirm")}</Button>
            <Button $variant="primary" onClick={answer.save}>
              {t("views.discard.save")}
            </Button>
          </>
        }
      >
        <Text>
          {leaving?.to === "manage" ? t("views.discard.leaveText") : t("views.discard.text", { name: leavingFor?.name ?? t("views.bar.noView") })}
        </Text>
      </Dialog>
    </Stack>
  );
}
