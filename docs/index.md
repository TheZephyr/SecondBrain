---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Second Brain"
  text: "A personal knowledge management tool"
  tagline: Work in progress docs for the project
  actions:
    - theme: brand
      text: Collections
      link: /collections/index
    - theme: alt
      text: Planned features
      link: /roadmap/planned-features

features:
  - title: Collections
    details: Creating, renaming, deleting collections; Dashboard
    link: /collections/index
  - title: Fields
    details: Field types, naming rules, reordering, select options, unsafe fields
    link: /collections/fields
  - title: Items
    details: Adding, editing, searching, sorting, pagination, bulk operations, row order
    link: /collections/items
  - title: Views
    details: View types, creating/renaming/deleting views, Grid view details, view config schema
    link: /collections/views
  - title: Import & Export
    details: CSV/JSON export, import modes, field matching, atomicity
    link: /collections/import-export
  - title: Planned features
    details: What's next in store
    link: /roadmap/planned-features
---

---

### What this wiki does not cover

Developer/agent-specific constraints (IPC safety, process boundaries, testing strategy, build commands) are documented in `AGENTS.md` in the repo root.