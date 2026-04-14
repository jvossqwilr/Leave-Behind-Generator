/**
 * Fetches relevant content from your Notion workspace.
 * Works with databases, pages, or auto-searches the workspace.
 *
 * Setup: create a Notion integration at notion.so/my-integrations
 * then connect it to your case studies, battle cards, and customers pages.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

export async function fetchNotionContent({ pains = [], priorities = [], competitor, industry } = {}) {
  if (!process.env.NOTION_TOKEN) {
    console.warn("NOTION_TOKEN not configured — skipping Notion fetch");
    return null;
  }

  try {
    const [caseStudies, battleCards, customers] = await Promise.all([
      fetchSection("CASE_STUDIES"),
      fetchSection("BATTLE_CARDS", competitor),
      fetchSection("CUSTOMERS"),
    ]);

    return format({ caseStudies, battleCards, customers, competitor });
  } catch (err) {
    console.warn("Notion fetch error:", err.message);
    return null;
  }
}

async function fetchSection(type, keyword = null) {
  const dbId = process.env[`NOTION_${type}_DB_ID`];
  const pageId = process.env[`NOTION_${type}_PAGE_ID`];

  if (dbId) return queryDatabase(dbId, keyword);
  if (pageId) return readPage(pageId);
  return searchWorkspace(type.toLowerCase().replace("_", " "));
}

async function queryDatabase(databaseId, keyword = null) {
  try {
    const body = keyword
      ? { filter: { property: "Name", title: { contains: keyword } }, page_size: 5 }
      : { page_size: 8 };

    const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = await res.json();

    const pages = await Promise.all(
      data.results.slice(0, 4).map(p => readPageBlocks(p.id, getTitle(p)))
    );
    return pages.filter(Boolean);
  } catch {
    return [];
  }
}

async function readPage(pageId) {
  try {
    const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=25`, {
      headers: headers(),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = blocksToText(data.results);
    return text ? [{ title: "Content", content: text.slice(0, 800) }] : [];
  } catch {
    return [];
  }
}

async function searchWorkspace(query) {
  try {
    const res = await fetch(`${NOTION_API}/search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ query, page_size: 5, filter: { value: "page", property: "object" } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    const pages = await Promise.all(
      data.results.slice(0, 3).map(p => readPageBlocks(p.id, getTitle(p)))
    );
    return pages.filter(Boolean);
  } catch {
    return [];
  }
}

async function readPageBlocks(pageId, title) {
  try {
    const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=20`, {
      headers: headers(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = blocksToText(data.results);
    if (!content || content.length < 30) return null;
    return { title: title || "Untitled", content: content.slice(0, 700) };
  } catch {
    return null;
  }
}

function blocksToText(blocks) {
  const supported = ["paragraph", "bulleted_list_item", "numbered_list_item", "heading_1", "heading_2", "heading_3", "quote", "callout"];
  return blocks
    .filter(b => supported.includes(b.type))
    .map(b => (b[b.type]?.rich_text || []).map(r => r.plain_text).join(""))
    .filter(t => t.trim())
    .join(" ")
    .trim();
}

function getTitle(page) {
  try {
    const titleProp = Object.values(page.properties || {}).find(p => p.type === "title");
    return titleProp?.title?.map(t => t.plain_text).join("") || "Untitled";
  } catch {
    return "Untitled";
  }
}

function format({ caseStudies, battleCards, customers, competitor }) {
  const parts = [];

  if (caseStudies?.length) {
    parts.push("=== CASE STUDIES ===");
    caseStudies.slice(0, 3).forEach(cs => {
      if (cs?.title && cs?.content) parts.push(`[${cs.title}]: ${cs.content}`);
    });
  }

  if (battleCards?.length && competitor) {
    parts.push(`\n=== BATTLE CARD: ${competitor} ===`);
    battleCards.slice(0, 2).forEach(bc => {
      if (bc?.content) parts.push(bc.content);
    });
  }

  if (customers?.length) {
    parts.push("\n=== CUSTOMER WINS ===");
    customers.slice(0, 3).forEach(c => {
      if (c?.title && c?.content) parts.push(`[${c.title}]: ${c.content}`);
    });
  }

  return parts.length ? parts.join("\n") : null;
}
