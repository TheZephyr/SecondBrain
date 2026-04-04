import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Second Brain",
  description: "Documentation for using and contributing to Second Brain",
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "User Guide", link: "/user/" },
      { text: "Developer Guide", link: "/developer/" },
      { text: "Roadmap", link: "/roadmap/" },
      { text: "GitHub", link: "https://github.com/TheZephyr/SecondBrain" },
    ],

    sidebar: {
      "/user/": [
        {
          text: "User Guide",
          collapsed: false,
          items: [
            { text: "Introduction", link: "/user/" },
            { text: "Getting Started", link: "/user/getting-started" },
            { text: "Navigation", link: "/user/navigation" },
            { text: "Collections", link: "/user/collections/" },
            { text: "Fields", link: "/user/collections/fields" },
            { text: "Items", link: "/user/collections/items" },
            { text: "Views", link: "/user/collections/views" },
            {
              text: "Import & Export",
              link: "/user/collections/import-export",
            },
            {
              text: "Settings & Recovery",
              link: "/user/settings-recovery",
            },
          ],
        },
      ],
      "/developer/": [
        {
          text: "Developer Guide",
          collapsed: false,
          items: [
            { text: "Introduction", link: "/developer/" },
            { text: "Setup", link: "/developer/setup" },
            { text: "Architecture", link: "/developer/architecture" },
            { text: "Electron & IPC", link: "/developer/electron-ipc" },
            { text: "Database & Worker", link: "/developer/database-worker" },
            {
              text: "Renderer & State",
              link: "/developer/frontend-patterns",
            },
            {
              text: "Data Model & Validation",
              link: "/developer/data-model-validation",
            },
            {
              text: "Import, Export & Recovery",
              link: "/developer/import-export-recovery",
            },
            {
              text: "Testing & Contributing",
              link: "/developer/testing-contributing",
            },
          ],
        },
      ],
      "/roadmap/": [
        {
          text: "Roadmap",
          collapsed: false,
          items: [
            { text: "Overview", link: "/roadmap/" },
            { text: "Planned Features", link: "/roadmap/planned-features" },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/TheZephyr/SecondBrain",
      },
    ],

    search: {
      provider: "local",
    },
  },
});
