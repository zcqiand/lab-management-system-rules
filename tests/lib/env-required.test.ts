import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "@/lib/env-required.js";

// fn: 基建无业务 fn-ID（R2 Task 3，非 trace 面）
describe("requireEnv", () => {
  const KEY = "RULES_TEST_ENV_REQUIRED_PROBE";
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[KEY];
    } else {
      process.env[KEY] = original;
    }
  });

  it("缺失时 throw 且报键名", () => {
    delete process.env[KEY];
    expect(() => requireEnv(KEY)).toThrow(KEY);
  });

  it("有值时返回该值", () => {
    process.env[KEY] = "hello";
    expect(requireEnv(KEY)).toBe("hello");
  });
});
