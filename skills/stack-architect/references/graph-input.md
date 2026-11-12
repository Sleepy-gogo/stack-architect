# GraphDocument input

The tool accepts `{ "document": { "version": 1, "title": "...", "nodes": [], "edges": [], "legend": { ... } } }`. `legend` is optional.
The advertised tool schema is authoritative. This is a bounded input profile of Stack Architect's GraphDocument, with positions and dimensions supplied by the server.

- IDs: 1 to 64 ASCII letters, digits, underscores or hyphens. Node IDs and edge IDs must each be unique.
- Limits: 80 nodes, 160 edges, 120-character title, 128,000 bytes for the complete MCP request.
- Every node has `id`, `type`, `data`, and optional `parentId`. Parents must be group nodes. Cycles are invalid; at most four levels of groups.
- `tech` data: required `slug`, `name`, `subtitle`, `category`; optional `note`, `colorOverride`, `dark`, `iconPlate`. The subtitle is at most 40 characters and shows on one line, so give it a few lowercase words such as `api routes`. About 18 characters of `name` fit on one line. Put detail in `note`.
- Categories: use the category returned by `search_architecture_icons`. All editor categories are supported, including `editors`, `design`, `productivity`, `software`, `browsers`, `media`, `social`, `gaming` and `crypto`.
- Discover icons with `search_architecture_icons({ "queries": ["Astro", "Sentry", "Mercado Pago"], "limit": 5 })`. Results contain exact slugs, names, subtitles and categories. Search is read-only. Unknown slugs are rejected with guidance to search again.
- Generic icon slugs: `browser`, `mobile`, `service`, `datastore`, `queue`, `cache`, `cdn`, `cron`, `bucket`, `thirdparty`. Use them for unnamed building blocks or after searching for a brand with no match. Brand examples include `astro`, `sentry`, `mercadopago`, `convex`, `resend`, `react`, `nextjs`, `postgresql` and `vercel`. Search the live catalog instead of treating this list as exhaustive.
- `group` data: required `label` and six-digit hex `color`; optional `dashed` and icon slug `icon`. The color is a border/heading accent, not a fill. Choose a medium tone such as `#8b5cf6`, `#0d9488`, `#64748b`; avoid near-white pastels. The editor derives a faint background tint and theme-adjusted stroke and heading colors without changing the saved hex value.
- `text` data: required `text`; optional hex `color` and `size` of `sm`, `md` or `lg`. Top-level text nodes are placed under the diagram.
- `legend`: optional `title` (40 characters) and 1 to 8 `items`, each with a `label` (40 characters), optional `style` of `solid` or `dashed`, and optional hex `color`. Give each item the same `colorOverride` and `style` as the arrows it explains; omit `color` for arrows without `colorOverride`. The legend renders as a card under the diagram. Use it instead of a text node.
- Edges: required `id`, `source`, `target`; optional `type: "tech"` and `data` containing `label`, `style` of `solid` or `dashed`, and six-digit hex `colorOverride`. Sources and targets can be tech nodes or groups. No self connections.
- Do not send arbitrary React Flow properties, styles, handles or external icon URLs.

Before creation, call `review_architecture_document` with the same `{ "document": ... }` wrapper. It does not publish or consume creation quota. Its response includes `summary` and `findings` with `code`, affected `nodeIds`, `edgeIds`, and a suggested revision. It flags six-plus connections on a component, eight-plus frame boundary crossings, dense overviews, pale frame accents, more than four arrow colors, and mixed arrow styles without a legend. These are review prompts, not hard limits or a visual correctness score. Review the revised draft once after addressing findings.

```json
{
  "document": {
    "version": 1,
    "title": "Checkout application",
    "nodes": [
      { "id": "hosting", "type": "group", "data": { "label": "Vercel", "color": "#64748b", "icon": "vercel" } },
      { "id": "web", "type": "tech", "parentId": "hosting", "data": { "slug": "astro", "name": "Storefront", "subtitle": "Astro", "category": "frontend", "note": "Entry: src/pages/" } },
      { "id": "api", "type": "tech", "data": { "slug": "service", "name": "API", "subtitle": "Nitro", "category": "backend", "note": "Routes: server/api/" } },
      { "id": "db", "type": "tech", "data": { "slug": "turso", "name": "Orders", "subtitle": "Turso", "category": "database" } },
      { "id": "payments", "type": "tech", "data": { "slug": "mercadopago", "name": "Mercado Pago", "subtitle": "checkout + webhooks", "category": "payment" } },
      { "id": "monitoring", "type": "tech", "data": { "slug": "sentry", "name": "Sentry", "subtitle": "error tracking", "category": "monitoring" } }
    ],
    "edges": [
      { "id": "web-api", "source": "web", "target": "api", "data": { "label": "HTTP", "style": "solid", "colorOverride": "#8b5cf6" } },
      { "id": "api-db", "source": "api", "target": "db", "data": { "label": "SQL", "style": "solid", "colorOverride": "#0d9488" } },
      { "id": "checkout", "source": "web", "target": "payments", "data": { "label": "checkout", "style": "solid", "colorOverride": "#0284c7" } },
      { "id": "status", "source": "payments", "target": "api", "data": { "label": "payment status", "style": "dashed", "colorOverride": "#0284c7" } },
      { "id": "errors", "source": "hosting", "target": "monitoring", "data": { "label": "errors", "style": "dashed", "colorOverride": "#64748b" } }
    ],
    "legend": {
      "title": "Arrows",
      "items": [
        { "label": "client requests", "style": "solid", "color": "#8b5cf6" },
        { "label": "persistence", "style": "solid", "color": "#0d9488" },
        { "label": "payments", "style": "solid", "color": "#0284c7" },
        { "label": "payment callbacks", "style": "dashed", "color": "#0284c7" },
        { "label": "telemetry", "style": "dashed", "color": "#64748b" }
      ]
    }
  }
}
```

Groups need no position or size. Put related nodes inside a group by referencing its ID in `parentId`; the server orders parents first and sizes frames around their children. The whole diagram is laid out left to right in one pass, frames included, so list the main flow's nodes and edges first: the layout keeps that order where it can. Solid edges set the direction. A dashed edge that answers a solid one, such as a webhook, does not move its caller. The editor picks arrow endpoints live, keeping arrows straight where cards line up and spreading the rest along each side. Endpoint coordinates and manual label positions are editor controls, not MCP input fields. Legacy node positions are accepted but ignored by the automatic layout.
