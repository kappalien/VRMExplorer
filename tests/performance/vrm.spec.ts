import { test, expect } from "@playwright/test";
test("user-supplied VRM0 passes container, real loader and WebGL render", async ({
  page,
}) => {
  await page.goto("/tests/performance/vrm.html");
  await expect(page.locator("#status")).toContainText('"loaded":true', {
    timeout: 60000,
  });
  const result = JSON.parse(await page.locator("#status").innerText());
  expect(result.version).toBe("0");
  expect(result.expressionChecks.length).toBeGreaterThanOrEqual(5);
  expect(
    result.expressionChecks
      .filter((e: { name: string; weight: number }) => e.name !== "neutral")
      .every((e: { weight: number }) => e.weight === 1),
  ).toBe(true);
  expect(result.drawCalls).toBeGreaterThan(0);
  console.log(JSON.stringify(result));
  await page.screenshot({ path: "test-results/vivian-webgl.png" });
});
