# Compose a diagram people can read

The first view should explain what happens when someone uses the system. Decide the main path before adding secondary integrations. Auto-layout can place objects and separate ports; it cannot decide which relationships deserve attention.

## What a good diagram looks like

A useful reference has a browser next to a backend frame, the database beside that frame, and a client frame inside its deployment provider. The development tools occupy their own strip. The backend shows its entry point, persistence layer and migrations. Payment checkout and the return webhook are separate, labeled flows. Library details live inside the client frame. Group headers carry the provider or runtime icon. Only relationships that explain the system receive arrows.

That composition works because the viewer can follow the main request, distinguish the payment callback, and inspect each subsystem without tracing a web of imports. Separate arrow attachment points keep fan-out readable. Restrained colors and dashed secondary lines make the main path easier to follow.

## Make these choices deliberately

| Do | Avoid |
| --- | --- |
| Organize around applications, runtime ownership and deployment boundaries. Nest a client inside its hosting frame when useful. | Put every external vendor in one enormous frame just because it is external. |
| Show a primary path such as browser → API → database, plus important side flows. | Reproduce every import, utility, notification and scheduled call in the overview. |
| Connect to a frame when the whole subsystem is the destination. | Repeat the same external connection to several children. |
| Use the actual brand icon, including in group headings. | Use a bell for every integration or a monitor for a known framework. |
| Use short role names with the technology or responsibility in the subtitle. | Repeat the same words in the name, subtitle and edge label. |
| Give tools their own group and leave most tooling unconnected. | Imply that formatters, IDEs or package managers are runtime services. |
| Use a small set of colors consistently for relationship families. | Color every arrow differently or leave a dense diagram entirely blue. |
| Label a return edge `payment status` or `webhook`; make secondary flows dashed. | Let dashed lines ambiguously mean both asynchronous and unverified. |
| State uncertainty in a note or label. | Invent a relationship to make the diagram look complete. |
| Check the total incoming and outgoing arrows before saving. | Assume different colors or dashed strokes make a crowded topology readable. |
| Give a frame a medium accent, such as `#8b5cf6`. | Use `#ddd6fe` as the frame color expecting a lavender fill. The same field controls its border and heading. |

## When a component has too many connections

Aim for two to four primary relationships on a component in an overview. Count incoming and outgoing arrows, including callbacks. At six, review the composition. At eight or more, usually restructure. These are review triggers, not hard limits: a real gateway may need more, and a detailed integration view has different needs.

Use this sequence:

1. Remove arrows that repeat a subtitle, containment or a note. A component being imported does not automatically justify a visible edge.
2. If a single node stands for several responsibilities, make a frame for the actual application/runtime and give those responsibilities their own nodes. Only use roles supported by code. Label them as modules or actions, not invented independently deployed services.
3. Keep local relationships within that frame. Put external integrations next to the responsible role. A payment provider remains outside the backend deployment frame even when it is close to billing actions.
4. When an external connection concerns the subsystem as a whole, connect to its frame. Consolidate only the same purpose and counterpart; do not merge requests, payment callbacks and telemetry into one vague `uses` arrow.
5. If the overview still needs many crossings, move secondary detail into notes. Offer a separate detail diagram when the user needs that subject, rather than silently creating several projects.

A frame buys room for distinct responsibilities and gives a subsystem a connection boundary. It does not make fourteen arrows into one generic `Functions` node readable. Do not put an empty frame around that same hub or move all fourteen arrows onto its border.

## Worked example: a crowded backend

Before: `Product functions` has fourteen incident arrows, while `Product app` has eight. Product traffic, authentication, payment callbacks, email delivery, PDF work and package imports all meet on those two cards. Pale frames make it harder to see which details belong together. Dashed imports span the whole page and compete with the runtime path.

After, when repository evidence supports these roles:

| Area | Composition | Relationships worth showing |
| --- | --- | --- |
| Customer application | App, offline queue and geocoding route in one frame. | Main data/session flow to the backend boundary; queue writes stay local. Explain replay in the queue note unless offline behavior is the subject. |
| Backend runtime | Product API, billing actions, document jobs, email actions, auth and data inside one frame. These are roles in the same runtime. | Product API → data. Billing → payment provider and its status callback. Document jobs → render worker and its callback. Email → delivery provider; delivery-status handling can be a note. |
| Administration | One app card, framed only if its boundary or contents matter. | One labeled administration connection to the backend subsystem. Avoid repeating every customer-app relationship. |
| Shared packages | UI, documents, imports and email templates in a separate reference frame. | No import mesh in a runtime overview. Notes name the consumers, e.g. “Used by the browser and PDF worker.” |
| Observability | A Sentry card or a note on the monitored applications. | Show per-application telemetry arrows only if monitoring is part of the story. |

This is a way to choose an abstraction level, not a mandatory architecture template. A smaller backend may deserve one node and fewer arrows. Do not invent internal dispatch calls to connect every role, duplicate the same database for symmetry, or remove a meaningful callback merely to reach a target count.

Keep the main left-to-right path easy to trace. Supporting tooling belongs off that path. Use short frame titles such as `Customer app` and `Backend`; put repository paths in node notes rather than long uppercase frame headings. Review any frame with eight or more boundary crossings: the same spaghetti can survive inside a well-named rectangle.

## A starting visual language

Choose the convention that fits the repository; this palette is an example, not a requirement:

- Primary requests: solid slate `#475569` or blue `#2563eb`.
- Client interactions: solid violet `#8b5cf6`.
- Persistence and migrations: teal `#0d9488`.
- Payments or callbacks: blue `#0284c7`, dashed for asynchronous returns.
- Tooling, imports and telemetry: muted slate `#64748b`, usually dashed.

Usually three or four colors suffice. Labels and line styles must still explain the relationships without color. Add a small `text` node as a legend when the conventions need explanation. The supported line styles are `solid` and `dashed`; do not send `dotted`.

Use group colors to mark boundaries without competing with the arrows. `group.data.color` supplies the accent for the border and heading; the editor derives a 5% background tint and adjusts the stroke and heading for the theme. Use medium tones, not pastel background colors such as `#ddd6fe`, `#ccfbf1`, or near-white `#f1f5f9`. Do not try to emulate a filled diagram box by sending a pale accent. Use `dark` cards and `iconPlate` only where they improve logo contrast. Notes hold evidence and caveats; they are not visible canvas prose.

## Review before creating

- Can the reader identify the entry point, main application and persistence without tracing every edge?
- Has every named technology been looked up in the icon catalog?
- Do frames describe architecture, and do their headers use relevant icons?
- Can redundant cross-frame edges be replaced by one correctly targeted subsystem connection?
- Are secondary relationships visually quieter, with a consistent meaning for dashes and colors?
- Does each arrow add information that grouping, a subtitle or a note cannot communicate?
- Did every component with six or more connections get reviewed, and every eight-plus hub get restructured or justified?
- Are shared-code dependencies separated from the runtime story, and are frame headings readable in light and dark appearances?

Use `review_architecture_document` to catch structural problems before publishing. It reports incident arrows, boundary crossings, density and pale accents. It cannot judge the architecture or guarantee crossing-free routes. Do not treat zero findings as a design score.

When a preview is available, inspect the diagram at fit-to-view and at readable zoom in both appearances. Trace the main path without reading notes. Check crossings, overlapping labels and long detours. If one small card has a wall of arrows or shared-package lines span the canvas, return to composition; recoloring does not fix it. Do not create duplicate public projects just to iterate on appearance after an ambiguous save. The JSON example in [graph-input.md](graph-input.md) demonstrates the supported fields together.
