import { test, expect } from "@playwright/test";
test("50,000 assets remain bounded, scrollable, searchable and keyboard accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tests/performance/harness.html");
  const list = page.getByRole("list", { name: "Assets" });
  await expect(list.getByText("素材-00000.png")).toBeVisible();
  expect(await page.getByRole("listitem").count()).toBeLessThan(30);
  await list.focus();
  const start = performance.now();
  await page.keyboard.press("End");
  await expect(list.getByText("素材-49999.png")).toBeVisible();
  await expect(list.getByRole("button", { name: "素材-49999.png" })).toBeFocused();
  const endNavigationMs = performance.now() - start;
  expect(await page.getByRole("listitem").count()).toBeLessThan(30);
  await page.getByLabel("Grid", { exact: true }).check();
  expect(await page.getByRole("listitem").count()).toBeLessThan(100);
  await list.focus();
  await page.keyboard.press("End");
  await expect(list.getByText("素材-49999.png")).toBeVisible();
  await page.getByRole("textbox", { name: "Search" }).fill("49999");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      count: 50000,
      endNavigationMs,
      pageErrors: errors.length,
    }),
  );
});
