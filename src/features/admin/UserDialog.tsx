"use client";

import { Field, Input, Notice, Select, Stack, Text } from "@/components/ui";
import { displayName, hasHebrew, type AuthError, type AuthUser } from "@/features/auth/model";
import { countActions, type PermissionMap } from "@/features/auth/permissions";
import { ROLES, roleLabelKey, roleSummaryKey, type Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/rules";
import { useI18n, type I18nKey } from "@/i18n";
import { useDraft } from "./kit";
import { FormDialog, Option } from "./tools/ui";
import { EMPTY_USER_DRAFT, USER_TEXT_FIELDS, changedPatch, draftOf, invalidFields, roleOptions, type UserDraft, type UserTextField } from "./users";

interface FieldText {
  label: I18nKey;
  invalid: I18nKey;
  /** Usernames and emails stay left-to-right in Hebrew. */
  ltr: boolean;
}

const FIELD_TEXT: Record<UserTextField, FieldText> = {
  firstName: { label: "admin.users.firstName", invalid: "admin.users.invalid.name", ltr: false },
  lastName: { label: "admin.users.lastName", invalid: "admin.users.invalid.name", ltr: false },
  username: { label: "admin.users.username", invalid: "admin.users.invalid.username", ltr: true },
  email: { label: "admin.users.email", invalid: "admin.users.invalid.email", ltr: true },
};

export interface UserDialogRequest {
  /** `null` creates a user. */
  user: AuthUser | null;
  /** Why this row cannot be edited; the form is then shown read-only. */
  lock: AuthError | null;
}

interface Props {
  /** `null` keeps the dialog closed. */
  request: UserDialogRequest | null;
  actor: Actor;
  roleDefaults: Record<Role, PermissionMap>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: UserDraft) => void;
}

/** Create and edit share this form: name, username, email and level. Status and reset link are row actions. */
export function UserDialog({ request, actor, roleDefaults, busy, onClose, onSubmit }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useDraft(request, (next) => (next?.user ? draftOf(next.user) : EMPTY_USER_DRAFT));
  const user = request?.user ?? null;
  const lock = request?.lock ?? null;
  const locked = lock !== null || busy;
  const invalid = invalidFields(draft);
  const dirty = user ? Object.keys(changedPatch(user, draft)).length > 0 : USER_TEXT_FIELDS.some((field) => draft[field] !== "");

  const setText = (field: UserTextField, value: string) => {
    // A username is typed in Latin characters: Hebrew letters are dropped as they are typed.
    if (field === "username" && hasHebrew(value)) return;
    setDraft({ ...draft, [field]: value });
  };

  return (
    <FormDialog
      open={request !== null}
      title={user ? displayName(user) : t("admin.users.create")}
      dirty={dirty && !locked}
      onClose={onClose}
      onSubmit={() => onSubmit(draft)}
      submitLabel={t(busy ? "admin.saving" : "action.save")}
      submitDisabled={locked || !dirty || invalid.length > 0}
    >
      {lock ? (
        <Notice $tone="warning" role="status">
          <Text $size="sm">{t(`auth.error.${lock.code}`)}</Text>
        </Notice>
      ) : null}
      {USER_TEXT_FIELDS.map((field) => (
        <Field key={field} label={t(FIELD_TEXT[field].label)} error={draft[field] !== "" && invalid.includes(field) ? t(FIELD_TEXT[field].invalid) : undefined}>
          {(id) => (
            <Input
              id={id}
              required
              dir={FIELD_TEXT[field].ltr ? "ltr" : undefined}
              type={field === "email" ? "email" : "text"}
              autoComplete="off"
              autoCapitalize={FIELD_TEXT[field].ltr ? "none" : undefined}
              spellCheck={false}
              disabled={locked}
              aria-invalid={draft[field] !== "" && invalid.includes(field)}
              value={draft[field]}
              onChange={(event) => setText(field, event.target.value)}
            />
          )}
        </Field>
      ))}
      <Field label={t("auth.level")} hint={`${t(roleSummaryKey(draft.role))} ${t("admin.users.roleGrants", { count: countActions(roleDefaults[draft.role]) })}`}>
        {(id) => (
          <Select id={id} disabled={locked} value={draft.role} onChange={(event) => setDraft({ ...draft, role: ROLES.find((role) => role === event.target.value) ?? draft.role })}>
            {roleOptions({ actor, editing: user !== null }).map((option) => (
              <Option key={option.role} value={option.role} disabled={option.disabled}>
                {t(roleLabelKey(option.role))}
              </Option>
            ))}
          </Select>
        )}
      </Field>
      <Stack $gap="xs">
        {actor.isRoot ? null : (
          <Text $muted $size="xs">
            {t("admin.users.topLevelRootOnly")}
          </Text>
        )}
        {user ? null : (
          <Notice $tone="info" role="note">
            <Text $size="sm">{t("admin.users.createNote")}</Text>
          </Notice>
        )}
      </Stack>
    </FormDialog>
  );
}
