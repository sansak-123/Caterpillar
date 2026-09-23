import { deleteSecureItem, getSecureItem, setSecureItem } from "./secureStore";
import { resetMockSecureStore } from "./testHelpers";

beforeEach(() => {
  resetMockSecureStore();
});

describe("secureStore", () => {
  it("round-trips a value", async () => {
    await setSecureItem("k", "v");
    expect(await getSecureItem("k")).toBe("v");
  });

  it("returns null for a key that was never set", async () => {
    expect(await getSecureItem("missing")).toBeNull();
  });

  it("deletes a value", async () => {
    await setSecureItem("k", "v");
    await deleteSecureItem("k");
    expect(await getSecureItem("k")).toBeNull();
  });
});
