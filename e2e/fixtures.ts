import { _electron as electron, test as base, expect } from "@playwright/test";
import type { ElectronApplication, Locator, Page } from "@playwright/test";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { IElectronAPI } from "../src/types/electron";
import type { IpcResult } from "../src/types/ipc";
import type {
  Collection,
  Field,
  Item,
  NewFieldInput,
  NewItemInput,
  NewViewInput,
  PaginatedItemsResult,
  View,
  ViewConfig,
} from "../src/types/models";

type DialogResults = {
  save?: Array<string | null>;
  open?: Array<string | null>;
};

type LaunchOptions = {
  userDataDir?: string;
  dialogResults?: DialogResults;
};

type LaunchedApp = {
  electronApp: ElectronApplication;
  page: Page;
  userDataDir: string;
  close: () => Promise<void>;
};

type LaunchApp = (options?: LaunchOptions) => Promise<LaunchedApp>;

const rootDir = path.resolve(__dirname, "..");
const mainPath = path.join(rootDir, "dist-electron", "main.js");

export const test = base.extend<{
  launchApp: LaunchApp;
}>({
  launchApp: async ({}, use, testInfo) => {
    const apps: LaunchedApp[] = [];
    const ownedUserDataDirs = new Set<string>();

    async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
      const userDataDir =
        options.userDataDir ??
        (await fs.mkdtemp(path.join(os.tmpdir(), "secondbrain-e2e-")));
      if (!options.userDataDir) {
        ownedUserDataDirs.add(userDataDir);
      }

      const launchEnv = {
        ...process.env,
        NODE_ENV: "test",
        SECOND_BRAIN_E2E: "1",
        SECOND_BRAIN_E2E_USER_DATA: userDataDir,
        SECOND_BRAIN_E2E_DIALOG_RESULTS: JSON.stringify(
          options.dialogResults ?? {},
        ),
      };
      delete launchEnv.ELECTRON_RUN_AS_NODE;

      const electronApp = await electron.launch({
        args: [mainPath],
        cwd: rootDir,
        env: launchEnv,
      });

      const page = await electronApp.firstWindow();
      page.on("console", (message) => {
        if (message.type() === "error") {
          testInfo.attach(`console-error-${Date.now()}`, {
            body: message.text(),
            contentType: "text/plain",
          }).catch(() => undefined);
        }
      });
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText("Second Brain").first()).toBeVisible();

      const app: LaunchedApp = {
        electronApp,
        page,
        userDataDir,
        close: async () => {
          await electronApp.close();
        },
      };
      apps.push(app);
      return app;
    }

    await use(launchApp);

    for (const app of apps.reverse()) {
      try {
        await app.electronApp.close();
      } catch {
        // The test may already have closed the app to verify restart behavior.
      }
    }

    if (process.env.SECOND_BRAIN_E2E_KEEP_ARTIFACTS === "1") {
      return;
    }

    for (const dir of ownedUserDataDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
});

export { expect };

function isIpcResult<T>(value: unknown): value is IpcResult<T> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as { ok?: unknown };
  return typeof result.ok === "boolean";
}

async function callElectronApi<T>(
  page: Page,
  method: keyof IElectronAPI,
  args: unknown[] = [],
): Promise<T> {
  const result = await page.evaluate(
    async ({ apiMethod, apiArgs }) => {
      const api = window.electronAPI as unknown as Record<
        string,
        (...values: unknown[]) => Promise<unknown>
      >;
      return api[apiMethod](...apiArgs);
    },
    { apiMethod: method, apiArgs: args },
  );

  if (!isIpcResult<T>(result)) {
    throw new Error(`Invalid IPC result from ${String(method)}.`);
  }

  if (!result.ok) {
    throw new Error(
      `IPC ${String(method)} failed: ${JSON.stringify(result.error)}`,
    );
  }

  return result.data;
}

export async function createCollection(
  page: Page,
  name: string,
): Promise<Collection> {
  const collection = await callElectronApi<Collection | null>(
    page,
    "addCollection",
    [{ name }],
  );
  if (!collection) {
    throw new Error("Collection was not created.");
  }
  return collection;
}

export async function createField(
  page: Page,
  input: NewFieldInput,
): Promise<NewFieldInput & { id: number }> {
  const field = await callElectronApi<(NewFieldInput & { id: number }) | null>(
    page,
    "addField",
    [input],
  );
  if (!field) {
    throw new Error(`Field ${input.name} was not created.`);
  }
  return field;
}

export async function createItem(
  page: Page,
  input: NewItemInput,
): Promise<Item> {
  const item = await callElectronApi<Item | null>(page, "addItem", [input]);
  if (!item) {
    throw new Error("Item was not created.");
  }
  return item;
}

export async function createView(
  page: Page,
  input: NewViewInput,
): Promise<View> {
  const view = await callElectronApi<View | null>(page, "addView", [input]);
  if (!view) {
    throw new Error(`View ${input.name} was not created.`);
  }
  return view;
}

export async function saveViewConfig(
  page: Page,
  viewId: number,
  config: ViewConfig,
): Promise<void> {
  await callElectronApi<boolean>(page, "updateViewConfig", [{ viewId, config }]);
}

export async function getCollections(page: Page): Promise<Collection[]> {
  return callElectronApi<Collection[]>(page, "getCollections");
}

export async function getFields(
  page: Page,
  collectionId: number,
): Promise<Field[]> {
  return callElectronApi<Field[]>(page, "getFields", [collectionId]);
}

export async function getViews(
  page: Page,
  collectionId: number,
): Promise<View[]> {
  return callElectronApi<View[]>(page, "getViews", [collectionId]);
}

export async function getViewConfig(
  page: Page,
  viewId: number,
): Promise<ViewConfig | null> {
  return callElectronApi<ViewConfig | null>(page, "getViewConfig", [viewId]);
}

export async function getItems(
  page: Page,
  collectionId: number,
): Promise<PaginatedItemsResult> {
  return callElectronApi<PaginatedItemsResult>(page, "getItems", [
    { collectionId, limit: 200, offset: 0, search: "", sort: [] },
  ]);
}

export async function openCollection(page: Page, name: string): Promise<void> {
  const dashboardCard = page.getByRole("heading", { name, exact: true });
  if ((await dashboardCard.count()) > 0) {
    await dashboardCard.click();
  } else {
    await page.locator("aside").getByText(name, { exact: true }).click();
  }
  await expect(
    page.locator("aside").getByText("Source", { exact: true }),
  ).toBeVisible();
}

export async function reloadCollection(page: Page, name: string): Promise<void> {
  await page.getByTestId("sidebar-dashboard").click();
  await openCollection(page, name);
}

export async function chooseSelectOption(
  page: Page,
  trigger: Locator,
  optionName: string,
): Promise<void> {
  await trigger.click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}
