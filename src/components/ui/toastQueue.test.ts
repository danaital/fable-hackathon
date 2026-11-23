import { describe, expect, it, vi } from "vitest";
import { TOAST_DURATION, TOAST_LIMIT, createToastStore } from "./toastQueue";

describe("toast store", () => {
  it("puts the newest toast on top and defaults to the medium duration", () => {
    const store = createToastStore();
    store.success({ title: "action.save" });
    const id = store.info({ title: "action.close" });
    const [top] = store.getSnapshot();
    expect(top.id).toBe(id);
    expect(top.duration).toBe(TOAST_DURATION.medium);
  });

  it("gives a toast with an action the long duration unless one is set", () => {
    const store = createToastStore();
    const action = { labelKey: "grid.retry", onClick: () => undefined } as const;
    store.error({ title: "grid.error", action });
    store.error({ title: "grid.empty", action, duration: TOAST_DURATION.permanent });
    expect(store.getSnapshot().map((toast) => toast.duration)).toEqual([TOAST_DURATION.permanent, TOAST_DURATION.long]);
  });

  it("drops the oldest toast past the limit", () => {
    const store = createToastStore();
    const ids = Array.from({ length: TOAST_LIMIT + 1 }, (_, n) => store.info({ title: "grid.rows", titleVars: { count: n } }));
    const shown = store.getSnapshot().map((toast) => toast.id);
    expect(shown).toHaveLength(TOAST_LIMIT);
    expect(shown).not.toContain(ids[0]);
    expect(shown[0]).toBe(ids[TOAST_LIMIT]);
  });

  it("does not add a duplicate and returns the id of the one on screen", () => {
    const store = createToastStore();
    const first = store.error({ title: "grid.rows", titleVars: { count: 1, page: 2 } });
    const again = store.error({ title: "grid.rows", titleVars: { page: 2, count: 1 } });
    expect(again).toBe(first);
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it("treats another type or other params as a different toast", () => {
    const store = createToastStore();
    store.error({ title: "grid.rows", titleVars: { count: 1 } });
    store.warning({ title: "grid.rows", titleVars: { count: 1 } });
    store.error({ title: "grid.rows", titleVars: { count: 2 } });
    expect(store.getSnapshot()).toHaveLength(3);
  });

  it("forgets a toast once it is dismissed, one at a time or all at once", () => {
    const store = createToastStore();
    const id = store.success({ title: "action.save" });
    store.dismiss(id);
    expect(store.getSnapshot()).toHaveLength(0);
    store.success({ title: "action.save" });
    store.dismissAll();
    store.success({ title: "action.save" });
    expect(store.getSnapshot()).toHaveLength(1);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const store = createToastStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.info({ title: "action.save" });
    unsubscribe();
    store.dismissAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
