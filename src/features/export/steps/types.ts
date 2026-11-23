import type { Dispatch } from "react";
import type { PageContext } from "../plan";
import type { FileTemplate, WizardState } from "../schema";
import type { WizardAction } from "../wizardState";

/** What every wizard step receives. A step edits the state only through `dispatch`. */
export interface StepProps {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  page: PageContext;
  /** The state the wizard opened with, for resets. */
  defaults: WizardState;
  fileTemplates: readonly FileTemplate[];
}
