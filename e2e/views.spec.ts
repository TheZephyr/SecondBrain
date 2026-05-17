import {
  createCollection,
  createField,
  expect,
  getFields,
  getViewConfig,
  getViews,
  openCollection,
  test,
} from "./fixtures";

test("child views can be created, renamed, configured, deleted, and restored after restart", async ({
  launchApp,
}) => {
  const app = await launchApp();
  const { page } = app;
  const collection = await createCollection(page, "E2E Views");
  await createField(page, {
    collectionId: collection.id,
    name: "Title",
    type: "text",
    options: null,
    orderIndex: 0,
  });
  await createField(page, {
    collectionId: collection.id,
    name: "Status",
    type: "select",
    options: JSON.stringify({ choices: ["Todo", "Done"] }),
    orderIndex: 1,
  });
  await createField(page, {
    collectionId: collection.id,
    name: "Due",
    type: "date",
    options: null,
    orderIndex: 2,
  });
  await createField(page, {
    collectionId: collection.id,
    name: "Score",
    type: "number",
    options: null,
    orderIndex: 3,
  });

  await page.reload();
  await openCollection(page, "E2E Views");

  await page.getByTestId("add-view-button").click();
  await page.getByTestId("view-type-kanban").click();
  await page.getByTestId("save-view-submit").click();
  await expect(
    page.locator("aside").getByText("Kanban", { exact: true }),
  ).toBeVisible();

  await page.getByTestId("add-view-button").click();
  await page.getByTestId("view-type-calendar").click();
  await page.getByTestId("save-view-submit").click();
  await expect(
    page.locator("aside").getByText("Calendar", { exact: true }),
  ).toBeVisible();

  await page.getByTestId("add-view-button").click();
  await page.getByTestId("view-type-grid").click();
  await page.getByTestId("save-view-submit").click();
  await expect(page.locator("aside").getByText("Grid", { exact: true })).toBeVisible();

  let views = await getViews(page, collection.id);
  const source = views.find((view) => view.is_default === 1);
  const kanban = views.find((view) => view.name === "Kanban");
  const grid = views.find((view) => view.name === "Grid");
  expect(source).toBeDefined();
  expect(kanban).toBeDefined();
  expect(grid).toBeDefined();
  await expect(page.locator(`[data-testid="delete-view-${source?.id}"]`)).toHaveCount(0);

  await page.getByTestId(`rename-view-${kanban?.id}`).click();
  await page.getByTestId("view-name-input").fill("Board E2E");
  await page.getByTestId("save-view-submit").click();
  await expect(
    page.locator("aside").getByText("Board E2E", { exact: true }),
  ).toBeVisible();

  await page.getByTestId(`delete-view-${grid?.id}`).click();
  await page.getByTestId(`confirm-delete-view-${grid?.id}`).click();
  await expect(page.locator("aside").getByText("Grid", { exact: true })).toHaveCount(0);

  views = await getViews(page, collection.id);
  const renamedKanban = views.find((view) => view.name === "Board E2E");
  expect(renamedKanban).toBeDefined();
  await page.getByTestId(`sidebar-view-${renamedKanban?.id}`).click();
  await page.getByTestId("collection-fields-tab").click();

  const scoreFieldRow = page.locator(
    '[data-testid="view-field-row"][data-field-name="Score"]',
  );
  await scoreFieldRow.getByRole("checkbox").click();
  await page.getByTestId("save-view-fields-button").click();

  const fields = await getFields(page, collection.id);
  const scoreField = fields.find((field) => field.name === "Score");
  const config = await getViewConfig(page, renamedKanban?.id ?? 0);
  expect(scoreField).toBeDefined();
  expect(config?.selectedFieldIds).not.toContain(scoreField?.id);

  await app.close();
  const restarted = await launchApp({ userDataDir: app.userDataDir });
  await openCollection(restarted.page, "E2E Views");
  await expect(
    restarted.page.locator("aside").getByText("Board E2E", { exact: true }),
  ).toBeVisible();
  const restartedViews = await getViews(restarted.page, collection.id);
  const restartedBoard = restartedViews.find((view) => view.name === "Board E2E");
  const restartedConfig = await getViewConfig(
    restarted.page,
    restartedBoard?.id ?? 0,
  );
  expect(restartedConfig?.selectedFieldIds).not.toContain(scoreField?.id);
});
