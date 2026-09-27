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

## A starting visual language

Choose the convention that fits the repository; this palette is an example, not a requirement:

- Primary requests: solid slate `#475569` or blue `#2563eb`.
- Client interactions: solid violet `#8b5cf6`.
- Persistence and migrations: teal `#0d9488`.
- Payments or callbacks: blue `#0284c7`, dashed for asynchronous returns.
- Tooling, imports and telemetry: muted slate `#64748b`, usually dashed.

Usually three or four colors suffice. Labels and line styles must still explain the relationships without color. Add a small `text` node as a legend when the conventions need explanation. The supported line styles are `solid` and `dashed`; do not send `dotted`.

Use group colors to mark boundaries without competing with the arrows. Use `dark` cards and `iconPlate` only where they improve logo contrast. Notes hold evidence and caveats; they are not visible canvas prose.

## Review before creating

- Can the reader identify the entry point, main application and persistence without tracing every edge?
- Has every named technology been looked up in the icon catalog?
- Do frames describe architecture, and do their headers use relevant icons?
- Can redundant cross-frame edges be replaced by one correctly targeted subsystem connection?
- Are secondary relationships visually quieter, with a consistent meaning for dashes and colors?
- Does each arrow add information that grouping, a subtitle or a note cannot communicate?

When a preview is available, inspect the diagram at fit-to-view and at readable zoom. Check crossings, overlapping labels and long detours. Reduce or regroup secondary relationships if needed. Do not create duplicate public projects just to iterate on appearance after an ambiguous save. The JSON example in [graph-input.md](graph-input.md) demonstrates the supported fields together.
