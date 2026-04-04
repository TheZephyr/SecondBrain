---
layout: home

hero:
  name: "Second Brain"
  text: "Documentation Portal"
  tagline: "User workflows, architecture notes, and the current product roadmap."
  actions:
    - theme: brand
      text: Open User Guide
      link: /user/
    - theme: alt
      text: Open Developer Guide
      link: /developer/
    - theme: alt
      text: View Roadmap
      link: /roadmap/

features:
  - title: User Guide
    details: Real UI labels, collection workflows, field types, views, import/export, backups, and recovery.
    link: /user/
    icon: "🧭"
  - title: Developer Guide
    details: Architecture, Electron and IPC boundaries, database worker design, data contracts, testing, and contribution flow.
    link: /developer/
    icon: "🛠️"
  - title: Roadmap
    details: Planned work that is still missing, including backend capabilities that already exist but are not fully wired into the UI.
    link: /roadmap/
    icon: "🗺️"
---

## Start Here

If you are using the app, start with the [User Guide](/user/) and follow the sections in order.

If you are working on the codebase, start with the [Developer Guide](/developer/) and read the architecture, Electron, and database pages before changing app behavior.

If you want the current implementation gap between code and product surface, check the [Roadmap](/roadmap/).
