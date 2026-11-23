"use client";

import { useCallback, useState } from "react";
import styled, { css } from "styled-components";
import { Button, Link, Ltr, Paragraph, Stack, Text, useToast } from "@/components/ui";
import type { PasswordRequestRow } from "@/features/auth/model";
import { ADMIN_AREA_MIN_ROLE } from "@/features/auth/roles";
import { RequireRole, useAuthStore } from "@/features/auth/session";
import { useFormatters } from "@/features/settings/useFormatters";
import { useI18n } from "@/i18n";
import { ALL_ROWS, LoadView, ScreenHeader, Toolbar, useAction, useLoad } from "./kit";
import { DataTable, type Column } from "./tools/table";
import { ConfirmDialog } from "./tools/ui";

const RejectButton = styled(Button)`
  ${({ theme: { color } }) => css`
    border-color: ${color.danger.fg};
    color: ${color.danger.fg};
  `}
`;

function Requests() {
  const { t } = useI18n();
  const store = useAuthStore();
  const toast = useToast();
  const { dateTime } = useFormatters();
  const load = useLoad(useCallback(() => store.listPasswordRequests(), [store]));
  const { busy, run } = useAction(load.reload);
  const [rejecting, setRejecting] = useState<PasswordRequestRow | null>(null);

  const approve = (request: PasswordRequestRow) =>
    run(async () => {
      const { emailSent } = await store.decidePasswordRequest({ id: request.id, decision: "approve" });
      // No email service in demo mode: the request is approved, the link was not delivered.
      toast[emailSent ? "success" : "warning"]({ title: emailSent ? "admin.requests.approved" : "admin.requests.approvedNoEmail", titleVars: { name: request.name } });
    });

  const reject = async () => {
    if (!rejecting) return;
    const done = await run(async () => {
      await store.decidePasswordRequest({ id: rejecting.id, decision: "reject" });
      toast.success({ title: "admin.requests.rejected", titleVars: { name: rejecting.name } });
    });
    if (done) setRejecting(null);
  };

  const columns: Column<PasswordRequestRow>[] = [
    { key: "name", header: t("admin.users.name"), cell: (request) => <Text $medium>{request.name}</Text> },
    { key: "username", header: t("admin.users.username"), cell: (request) => <Ltr>{request.username}</Ltr> },
    {
      key: "email",
      header: t("admin.users.email"),
      cell: (request) => (
        <Link href={`mailto:${request.email}`}>
          <Ltr>{request.email}</Ltr>
        </Link>
      ),
    },
    { key: "requestedAt", header: t("admin.requests.requestedAt"), cell: (request) => <Ltr>{dateTime(request.requestedAt)}</Ltr> },
    {
      key: "actions",
      header: t("admin.actions"),
      cell: (request) => (
        // While one decision runs, every row waits.
        <Stack $row $wrap $gap="sm">
          <Button type="button" $variant="primary" disabled={busy} aria-label={t("admin.requests.approveFor", { name: request.name })} onClick={() => void approve(request)}>
            {t("admin.requests.approve")}
          </Button>
          <RejectButton type="button" disabled={busy} aria-label={t("admin.requests.rejectFor", { name: request.name })} onClick={() => setRejecting(request)}>
            {t("admin.requests.reject")}
          </RejectButton>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <Toolbar onRefresh={load.reload} />
      <LoadView load={load}>
        {(requests) => (
          <DataTable caption={t("admin.nav.passwordRequests")} columns={columns} rows={requests} rowKey={(request) => request.id} empty={t("admin.requests.empty")} pageSize={ALL_ROWS} />
        )}
      </LoadView>
      <ConfirmDialog danger open={rejecting !== null} title={t("admin.requests.rejectTitle")} confirmLabel={t("admin.requests.reject")} onConfirm={() => void reject()} onClose={() => setRejecting(null)}>
        <Paragraph>{t("admin.requests.rejectBody", { name: rejecting?.name ?? "" })}</Paragraph>
      </ConfirmDialog>
    </>
  );
}

/** Pending forgot-password requests, for the root administrator to approve or reject. */
export function PasswordRequestsScreen() {
  return (
    <Stack $gap="lg">
      <ScreenHeader titleKey="admin.nav.passwordRequests" descKey="admin.requests.desc" />
      <RequireRole min={ADMIN_AREA_MIN_ROLE} rootOnly>
        <Requests />
      </RequireRole>
    </Stack>
  );
}
