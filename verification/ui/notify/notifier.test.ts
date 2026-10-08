import { CONFIRM_ICONS, DURATIONS, createNotifier, dismissResult } from "../../../src/ui/notify/notifier";

describe("notifier banners (notifications spec §3.1)", () => {
  it("shows one banner at a time and replaces it with a new id", () => {
    const n = createNotifier();
    const a = n.show("success", "Saved", "Transaction added");
    const b = n.show("error", "Amount required");
    expect(n.getState().toast).toEqual(b);
    expect(b.id).not.toBe(a.id);
    expect(a).toMatchObject({ kind: "success", title: "Saved", message: "Transaction added", duration: 2200 });
  });
  it("uses the spec durations", () => {
    expect(DURATIONS).toEqual({ success: 2200, info: 2800, error: 3500 });
  });
  it("dismiss with a stale id is ignored", () => {
    const n = createNotifier();
    const a = n.show("info", "A");
    const b = n.show("info", "B");
    n.dismiss(a.id);
    expect(n.getState().toast).toEqual(b);
    n.dismiss(b.id);
    expect(n.getState().toast).toBeNull();
  });
  it("gives getState a new object after every change and notifies subscribers", () => {
    const n = createNotifier();
    const calls: number[] = [];
    const unsubscribe = n.subscribe(() => calls.push(1));
    const before = n.getState();
    n.show("info", "Hi");
    expect(n.getState()).not.toBe(before);
    unsubscribe();
    n.show("info", "Again");
    expect(calls).toHaveLength(1);
  });
});

describe("notifier confirms (notifications spec §3.1)", () => {
  it("fills defaults and picks the icon from the tone", () => {
    const n = createNotifier();
    void n.confirm({ title: "Delete customer?", tone: "danger", confirmLabel: "Delete" });
    void n.confirm({ title: "Continue?" });
    const [del, plain] = n.getState().confirms;
    expect(del).toMatchObject({ title: "Delete customer?", confirmLabel: "Delete", cancelLabel: "Cancel", tone: "danger", icon: CONFIRM_ICONS.danger });
    expect(plain).toMatchObject({ confirmLabel: "OK", cancelLabel: "Cancel", tone: "primary", icon: "help-circle-outline" });
    expect(CONFIRM_ICONS).toEqual({ danger: "trash-outline", warning: "alert-circle-outline", primary: "help-circle-outline" });
  });
  it("answers first-in first-out and resolves each promise with the choice", async () => {
    const n = createNotifier();
    const first = n.confirm({ title: "One" });
    const second = n.confirm({ title: "Two" });
    const [a, b] = n.getState().confirms;
    n.answer(a.id, true);
    expect(n.getState().confirms.map((c) => c.title)).toEqual(["Two"]);
    n.answer(b.id, false);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
    expect(n.getState().confirms).toEqual([]);
  });
  it("answer twice resolves once", async () => {
    const n = createNotifier();
    const p = n.confirm({ title: "Once" });
    const id = n.getState().confirms[0].id;
    n.answer(id, true);
    n.answer(id, false);
    await expect(p).resolves.toBe(true);
  });
  it("queues confirms before any host mounts", () => {
    const n = createNotifier();
    void n.confirm({ title: "Update available" });
    expect(n.getState().activeHost).toBeNull();
    expect(n.getState().confirms).toHaveLength(1);
  });
  it("treats back/backdrop as Cancel, or as OK for a single-button dialog", () => {
    const n = createNotifier();
    void n.confirm({ title: "Two buttons" });
    void n.confirm({ title: "Notice", cancelLabel: null });
    const [two, one] = n.getState().confirms;
    expect(dismissResult(two)).toBe(false);
    expect(one.cancelLabel).toBeNull();
    expect(dismissResult(one)).toBe(true);
  });
});

describe("toast host stack (notifications spec §3.1)", () => {
  it("activates the last registered host and falls back when it is released", () => {
    const n = createNotifier();
    const root = n.registerToastHost();
    expect(n.getState().activeHost).toBe(root.id);
    const sheet = n.registerToastHost();
    expect(n.getState().activeHost).toBe(sheet.id);
    sheet.release();
    expect(n.getState().activeHost).toBe(root.id);
    sheet.release();
    expect(n.getState().activeHost).toBe(root.id);
    root.release();
    expect(n.getState().activeHost).toBeNull();
  });
  it("keeps the newer host active when an older one is released first", () => {
    const n = createNotifier();
    const a = n.registerToastHost();
    const b = n.registerToastHost();
    a.release();
    expect(n.getState().activeHost).toBe(b.id);
  });
});
