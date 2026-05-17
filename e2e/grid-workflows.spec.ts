import {
  createCollection,
  createField,
  createItem,
  expect,
  getItems,
  openCollection,
  test,
} from "./fixtures";

test("fields, items, search, sort, and restart persistence work together", async ({
  launchApp,
}) => {
  const app = await launchApp();
  const { page } = app;
  const collection = await createCollection(page, "E2E Tasks");
  await createField(page, {
    collectionId: collection.id,
    name: "Title",
    type: "text",
    options: null,
    orderIndex: 0,
  });
  await createField(page, {
    collectionId: collection.id,
    name: "Score",
    type: "number",
    options: null,
    orderIndex: 1,
  });
  await createField(page, {
    collectionId: collection.id,
    name: "Due",
    type: "date",
    options: null,
    orderIndex: 2,
  });

  await page.reload();
  await openCollection(page, "E2E Tasks");

  await expect(
    page.locator('[data-testid="grid-header-cell"][data-field-name="Title"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="grid-header-cell"][data-field-name="Score"]'),
  ).toBeVisible();

  await page.getByTestId("quick-add-item-button").click();
  await page
    .locator('[data-testid="item-field-input"][data-field-name="Title"]')
    .fill("Alpha task");
  await page.getByLabel("Score").fill("10");
  await page
    .locator('[data-testid="item-field-input"][data-field-name="Due"]')
    .fill("2026-05-17");
  await page.getByTestId("save-item-button").click();

  await expect(page.getByText("Alpha task", { exact: true })).toBeVisible();

  await createItem(page, {
    collectionId: collection.id,
    data: { Title: "Gamma task", Score: 30, Due: "2026-05-19" },
  });
  await createItem(page, {
    collectionId: collection.id,
    data: { Title: "Beta task", Score: 20, Due: "2026-05-18" },
  });

  await page.reload();
  await openCollection(page, "E2E Tasks");

  await page.getByTestId("grid-search-input").fill("Gamma");
  await expect(page.getByText("Gamma task", { exact: true })).toBeVisible();
  await expect(page.getByText("Alpha task", { exact: true })).toHaveCount(0);
  await page.getByTestId("grid-search-input").fill("");

  await page
    .locator('[data-testid="grid-header-cell"][data-field-name="Title"]')
    .click();
  await expect(
    page.locator('[data-testid="grid-row"]').nth(0).locator('[data-field-name="Title"]'),
  ).toContainText("Alpha task");

  const firstTitleCell = page
    .locator('[data-testid="grid-row"]')
    .nth(0)
    .locator('[data-field-name="Title"]');
  await firstTitleCell.dblclick();
  await page.getByTestId("grid-editor-input").fill("Alpha task edited");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Alpha task edited", { exact: true })).toBeVisible();

  await page.locator('[data-testid="grid-row"]').nth(0).click({ button: "right" });
  await page.getByTestId("grid-context-menu-duplicate-row").click();
  await expect(page.getByText("Alpha task edited", { exact: true })).toHaveCount(2);

  await page.locator('[data-testid="grid-row-select"]').first().click({ force: true });
  await page.getByTestId("bulk-delete-items-button").click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Alpha task edited", { exact: true })).toHaveCount(1);

  expect((await getItems(page, collection.id)).total).toBe(3);

  await app.close();
  const restarted = await launchApp({ userDataDir: app.userDataDir });
  await openCollection(restarted.page, "E2E Tasks");
  await expect(
    restarted.page
      .locator('[data-testid="grid-row"]')
      .nth(0)
      .locator('[data-field-name="Title"]'),
  ).toContainText("Alpha task edited");
});
