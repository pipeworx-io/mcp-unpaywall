interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Unpaywall MCP — open-access lookup for scholarly papers (free, no key)
 *
 * Pairs with Crossref / OpenAlex: given a DOI, Unpaywall tells you if a free
 * legal version exists and where (publisher, repository, etc.).
 *
 * "Auth": no key, but a contact email is required via ?email=... — Unpaywall
 * uses it as a polite-pool identifier (so they can reach you if your traffic
 * patterns ever cause issues). Set PLATFORM_UNPAYWALL_EMAIL on the gateway,
 * or BYO via ?_email=you@example.com.
 *
 * API: https://unpaywall.org/products/api
 * Tools:
 * - get_oa:          OA status + best-available location for a DOI
 * - search_papers:   keyword search, optionally OA-only
 */


const BASE_URL = 'https://api.unpaywall.org/v2';

const tools: McpToolExport['tools'] = [
  {
    name: 'get_oa',
    description:
      'Given a DOI, fetch open-access status and the best free legal copy if one exists. Returns is_oa, oa_status (gold | green | hybrid | bronze | closed), best location (URL, host type, license), and journal metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        doi: { type: 'string', description: 'DOI (e.g., "10.1038/nature12373")' },
      },
      required: ['doi'],
    },
  },
  {
    name: 'search_papers',
    description:
      'Keyword search across Unpaywall\'s coverage of scholarly papers. Optionally restrict to OA-only. Returns up to 50 results per page.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        is_oa: { type: 'boolean', description: 'Restrict to open-access papers' },
        page: { type: 'number', description: '1-based page (default 1)' },
      },
      required: ['query'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const email = (args._email as string | undefined)?.trim();
  if (!email) {
    throw new Error(
      'Unpaywall requires a contact email (polite-pool identifier). Pass ?_email=you@example.com, or contact the operator to configure PLATFORM_UNPAYWALL_EMAIL.',
    );
  }
  switch (name) {
    case 'get_oa':
      return getOa(email, String(args.doi));
    case 'search_papers':
      return searchPapers(email, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function upFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 404) throw new Error('Unpaywall: DOI not found');
  if (res.status === 422) throw new Error('Unpaywall: invalid DOI or query (HTTP 422)');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unpaywall error: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

interface OaRecord {
  doi?: string;
  doi_url?: string;
  title?: string;
  genre?: string;
  is_oa?: boolean;
  oa_status?: string;
  has_repository_copy?: boolean;
  journal_name?: string;
  journal_issns?: string;
  journal_is_oa?: boolean;
  journal_is_in_doaj?: boolean;
  publisher?: string;
  published_date?: string;
  year?: number;
  best_oa_location?: OaLocation | null;
  oa_locations?: OaLocation[];
  z_authors?: { given?: string; family?: string }[];
}

interface OaLocation {
  url?: string;
  url_for_pdf?: string;
  host_type?: string;
  version?: string;
  license?: string;
  is_best?: boolean;
  evidence?: string;
  endpoint_id?: string;
  repository_institution?: string;
}

function normalizeLocation(loc: OaLocation | null | undefined) {
  if (!loc) return null;
  return {
    url: loc.url ?? null,
    pdf_url: loc.url_for_pdf ?? null,
    host_type: loc.host_type ?? null,
    version: loc.version ?? null,
    license: loc.license ?? null,
    repository: loc.repository_institution ?? null,
    evidence: loc.evidence ?? null,
  };
}

function normalizeRecord(r: OaRecord) {
  return {
    doi: r.doi ?? null,
    doi_url: r.doi_url ?? null,
    title: r.title ?? null,
    genre: r.genre ?? null,
    year: r.year ?? null,
    published_date: r.published_date ?? null,
    publisher: r.publisher ?? null,
    journal_name: r.journal_name ?? null,
    journal_issns: r.journal_issns ?? null,
    journal_is_oa: r.journal_is_oa ?? null,
    journal_in_doaj: r.journal_is_in_doaj ?? null,
    is_oa: r.is_oa ?? false,
    oa_status: r.oa_status ?? null,
    has_repository_copy: r.has_repository_copy ?? null,
    authors: (r.z_authors ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
    best_location: normalizeLocation(r.best_oa_location),
    other_locations: (r.oa_locations ?? [])
      .filter((l) => !l.is_best)
      .map((l) => normalizeLocation(l))
      .filter(Boolean),
  };
}

async function getOa(email: string, doi: string) {
  if (!doi) throw new Error('doi is required');
  const url = `${BASE_URL}/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
  const data = await upFetch<OaRecord>(url);
  return normalizeRecord(data);
}

async function searchPapers(email: string, args: Record<string, unknown>) {
  const params = new URLSearchParams({
    query: String(args.query),
    email,
  });
  if (args.is_oa) params.set('is_oa', 'true');
  if (args.page) params.set('page', String(args.page));

  const data = await upFetch<{ results?: { response?: OaRecord; score?: number }[] }>(
    `${BASE_URL}/search?${params}`,
  );

  const results = (data.results ?? [])
    .filter((r) => r.response)
    .map((r) => ({ score: r.score ?? null, ...normalizeRecord(r.response as OaRecord) }));

  return {
    query: args.query,
    page: args.page ?? 1,
    returned: results.length,
    results,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
