# GraphDocument input

The tool accepts `{ "document": { "version": 1, "title": "...", "nodes": [], "edges": [] } }`.
The advertised tool schema is authoritative. This is a bounded input profile of Stack Architect's GraphDocument, with positions and dimensions supplied by the server.

- IDs: 1 to 64 ASCII letters, digits, underscores or hyphens. Node IDs and edge IDs must each be unique.
- Limits: 80 nodes, 160 edges, 120-character title, 128,000 bytes for the complete MCP request.
- Every node has `id`, `type`, `data`, and optional `parentId`. Parents must be group nodes. Cycles are invalid; at most four levels of groups.
- `tech` data: required `slug`, `name`, `subtitle`, `category`; optional `note`, `colorOverride`, `dark`, `iconPlate`.
- Categories: use the category returned by `search_architecture_icons`. All editor categories are supported, including `editors`, `design`, `productivity`, `software`, `browsers`, `media`, `social`, `gaming` and `crypto`.
- Discover icons with `search_architecture_icons({ "queries": ["Astro", "Sentry", "Mercado Pago"], "limit": 5 })`. Results contain exact slugs, names, subtitles and categories. Search is read-only. Unknown slugs are rejected with guidance to search again.
- Generic icon slugs: `browser`, `mobile`, `service`, `datastore`, `queue`, `cache`, `cdn`, `cron`, `bucket`, `thirdparty`. Use them for unnamed building blocks or after searching for a brand with no match. Brand examples include `astro`, `sentry`, `mercadopago`, `convex`, `resend`, `react`, `nextjs`, `postgresql` and `vercel`. Search the live catalog instead of treating this list as exhaustive.
- `group` data: required `label` and six-digit hex `color`; optional `dashed` and icon slug `icon`.
- `text` data: required `text`; optional hex `color` and `size` of `sm`, `md` or `lg`.
- Edges: required `id`, `source`, `target`; optional `type: "tech"` and `data` containing `label`, `style` of `solid` or `dashed`, and six-digit hex `colorOverride`. Sources and targets can be tech nodes or groups. No self connections.
- Do not send arbitrary React Flow properties, styles, handles or external icon URLs.

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
      { "id": "payments", "type": "tech", "data": { "slug": "mercadopago", "name": "Mercado Pago", "subtitle": "Checkout + webhooks", "category": "payment" } },
      { "id": "monitoring", "type": "tech", "data": { "slug": "sentry", "name": "Sentry", "subtitle": "Error tracking", "category": "monitoring" } },
      { "id": "legend", "type": "text", "data": { "text": "Solid: requests and data\nDashed: callbacks and telemetry", "size": "sm", "color": "#64748b" } }
    ],
    "edges": [
      { "id": "web-api", "source": "web", "target": "api", "data": { "label": "HTTP", "style": "solid", "colorOverride": "#8b5cf6" } },
      { "id": "api-db", "source": "api", "target": "db", "data": { "label": "SQL", "style": "solid", "colorOverride": "#0d9488" } },
      { "id": "checkout", "source": "web", "target": "payments", "data": { "label": "checkout", "style": "solid", "colorOverride": "#0284c7" } },
      { "id": "status", "source": "payments", "target": "api", "data": { "label": "payment status", "style": "dashed", "colorOverride": "#0284c7" } },
      { "id": "errors", "source": "hosting", "target": "monitoring", "data": { "label": "errors", "style": "dashed", "colorOverride": "#64748b" } }
    ]
  }
}
```

Groups need no position or size. Put related nodes inside a group by referencing its ID in `parentId`; the server orders parents first and sizes frames around their children. It assigns arrow endpoints after the final nested layout, spreading connections along each side. Endpoint coordinates and manual label positions are editor controls, not MCP input fields. Legacy node positions are accepted but ignored by the automatic layout.
