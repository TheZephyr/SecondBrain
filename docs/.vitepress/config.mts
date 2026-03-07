import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Second Brain",
  description: "A personal knowledge management tool",
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Vitepress", link: "https://vitepress.dev/" },
    ],

    sidebar: [
      {
        text: "Collections",
        items: [
          { text: "Overview", link: "/collections/index" },
          { text: "Fields", link: "/collections/fields" },
          { text: "Items", link: "/collections/items" },
          { text: "Views", link: "/collections/views" },
          { text: "Import & Export", link: "/collections/import-export" },
        ],
      },
      {
        text: "Roadmap",
        items: [
          { text: "Planned features", link: "/roadmap/planned-features" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/TheZephyr/SecondBrain" },
    ],

    search: {
      provider: "local",
    },
  },
  locales: {
    root: { label: "English", lang: "en-US", dir: "ltr" },
    pl: { label: "Polski", lang: "pl-PL", dir: "ltr" },
  },
});
