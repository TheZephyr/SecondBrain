import { test, expect, getCollections } from "./fixtures";

test("collection CRUD works through the Electron UI", async ({ launchApp }) => {
  const { page } = await launchApp();

  await page.getByTestId("new-collection-button").click();
  await page.getByTestId("new-collection-name-input").fill("E2E Library");
  await page.getByTestId("create-collection-submit").click();

  await expect(
    page.locator("aside").getByText("E2E Library", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("aside").getByText("Source", { exact: true }),
  ).toBeVisible();

  await page.getByTestId("collection-settings-button").click();
  await page.getByTestId("collection-name-input").fill("E2E Library Renamed");
  await page.getByTestId("save-collection-settings-button").click();

  await expect(
    page.locator("aside").getByText("E2E Library Renamed", { exact: true }),
  ).toBeVisible();

  await page.getByTestId("collection-settings-button").click();
  await page.getByRole("button", { name: "Danger Zone" }).click();
  await page.getByTestId("delete-collection-button").click();
  await page.getByRole("button", { name: "Delete Collection" }).click();

  await expect(
    page.getByText("E2E Library Renamed", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  expect(await getCollections(page)).toEqual([]);
});
