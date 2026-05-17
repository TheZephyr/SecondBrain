import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useNotificationsStore } from "../notifications";

describe("notifications store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with an empty queue", () => {
    const store = useNotificationsStore();
    expect(store.queue).toEqual([]);
  });

  it("pushes messages to the queue", () => {
    const store = useNotificationsStore();
    store.push({ severity: "success", summary: "Saved", detail: "Item saved" });
    expect(store.queue).toHaveLength(1);
    expect(store.queue[0].summary).toBe("Saved");
  });

  it("shifts messages from the queue", () => {
    const store = useNotificationsStore();
    store.push({ summary: "First" });
    store.push({ summary: "Second" });

    const first = store.shift();
    expect(first?.summary).toBe("First");
    expect(store.queue).toHaveLength(1);
    expect(store.queue[0].summary).toBe("Second");

    const second = store.shift();
    expect(second?.summary).toBe("Second");
    expect(store.queue).toHaveLength(0);

    const third = store.shift();
    expect(third).toBeUndefined();
  });
});
