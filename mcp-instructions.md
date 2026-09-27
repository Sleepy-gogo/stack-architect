# Set up Stack Architect

Use these instructions when a user asks you to connect their coding agent to Stack Architect. Configure the MCP client, install the repository-analysis skill, and verify tool discovery. Creating a diagram is a separate request.

Source repository: https://github.com/Sleepy-gogo/stack-architect

## Get the connection details

Use `https://stack.axelc.dev/api/mcp` unless the user specifies their own deployment. Identify the user's MCP client and operating system from the environment. Ask only for details you cannot determine.

The endpoint is `<editor-origin>/api/mcp`, using Streamable HTTP. Require HTTPS except for an explicitly requested localhost development server. Strip neither a custom path nor credentials silently; ask for the editor origin if the supplied URL is ambiguous.

The endpoint is public. No token, API key, OAuth login, Turso credentials, or Vercel access is needed. Users hosting their own deployment can follow [README.md](README.md#host-your-own-server).

## Configure the client

Use user-level configuration so the connection works across repositories. Preserve other servers and settings. Update an existing `stack_architect` entry instead of adding a duplicate. Keep a local backup before changing an existing configuration file.

For Codex, merge this into the active user configuration, normally `~/.codex/config.toml`. Honor a custom `CODEX_HOME` if configured. Replace the URL only if the user chose another deployment:

```toml
[mcp_servers.stack_architect]
url = "https://stack.axelc.dev/api/mcp"
```

If updating an older Stack Architect configuration, remove its bearer-token setting and Authorization header. Leave credentials for other servers untouched.

For another MCP client, use its documented HTTP server configuration with authentication set to none. Check the installed client's help or official documentation before choosing its config syntax.

## Install the skill

Use `skills/stack-architect/` from the source repository. If it is already checked out locally, copy from that checkout. Otherwise download these files from the same branch or revision of the source repository, preserving their paths within `stack-architect/`:

- `SKILL.md`
- `agents/openai.yaml`
- `references/graph-input.md`
- `references/diagram-design.md`

For downloads, the source directory is `https://raw.githubusercontent.com/Sleepy-gogo/stack-architect/main/skills/stack-architect/`. These are text files; installation requires no script execution or application dependencies.

Codex's documented user-level skill directory is `~/.agents/skills/`. Install the folder as `~/.agents/skills/stack-architect/`. If the client already discovers a `stack-architect` skill in another user directory, use that location and preserve local customizations rather than installing a second copy. Other agents should use their supported user-level skill location. If the client does not support skills, explain that MCP tools can still be called directly.

## Verify the connection

Reload the client if necessary. Use its MCP connection check to initialize the server and list tools. Confirm that `search_architecture_icons`, `review_architecture_document` and `create_architecture_project` appear and that the client discovers the skill. Test read-only icon search with Astro, Sentry and Mercado Pago. A GET request in a browser is not a connection test: this endpoint accepts POST.

Do not call the creation tool just to check setup. It saves a public-by-link diagram and consumes the creation quota. If the client needs a restart before tools become available, report that verification is pending rather than claiming it passed.

Common failures:

| Response            | What to check                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401 or a login page | Confirm the deployment runs the public endpoint and that hosting-level access protection is not blocking it. Do not invent or request an MCP token. |
| 403                 | A supplied Origin header must match the configured editor origin.                                                                                   |
| 404                 | Confirm the deployment URL and `/api/mcp` path.                                                                                                     |
| 405                 | Use the client's Streamable HTTP connection, not a browser GET.                                                                                     |
| 429                 | Wait for the server's `Retry-After` interval.                                                                                                       |
| 503                 | The host must check MCP configuration and Turso availability.                                                                                       |

Finish with the endpoint, the configuration and skill paths you changed, and the checks that passed or remain pending. Give the user this example:

> Use $stack-architect to analyze this repository and create an editable architecture diagram.

The returned link opens an editable local copy. Anyone with the link can read it. Edits stay in that browser until the user publishes a new link with Share.

For client-specific details, consult [OpenAI MCP configuration](https://learn.chatgpt.com/docs/extend/mcp) and [skill locations](https://learn.chatgpt.com/docs/build-skills).
