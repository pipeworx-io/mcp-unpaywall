# @pipeworx/unpaywall

Unpaywall MCP — open-access paper lookup, no API key (polite-pool email).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `get_oa(doi)` — OA status + best free legal copy for a DOI.
- `search_papers(query, is_oa?, page?)` — keyword search, optionally OA-only.

## Auth

Unpaywall requires a contact email as a polite-pool identifier.

- **Platform email:** gateway env `PLATFORM_UNPAYWALL_EMAIL` (injected as `_email`).
- **BYO:** `?_email=you@example.com` on the gateway URL.

## Data source

`https://api.unpaywall.org/v2/` — public, email-identified.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "unpaywall": {
      "url": "https://gateway.pipeworx.io/unpaywall/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Unpaywall data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
