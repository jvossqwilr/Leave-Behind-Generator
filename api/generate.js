import Groq from "groq-sdk";
import { scrapeG2Reviews } from "../lib/scraper.js";
import { fetchNotionContent } from "../lib/notion.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const COMPETITOR_G2_SLUGS = {
  PandaDoc: "pandadoc",
  Proposify: "proposify",
  "Better Proposals": "better-proposals",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    company, contact, industry, companySize,
    competitor, pains, priorities, repNotes,
  } = req.body;

  if (!company) return res.status(400).json({ error: "Company name is required" });

  try {
    // Scrape G2 + fetch Notion in parallel for speed
    const [qwilrReviews, competitorReviews, notionContent] = await Promise.all([
      scrapeG2Reviews("qwilr", { limit: 12 }),
      competitor && COMPETITOR_G2_SLUGS[competitor]
        ? scrapeG2Reviews(COMPETITOR_G2_SLUGS[competitor], { limit: 8, negativeOnly: true })
        : Promise.resolve([]),
      fetchNotionContent({ pains, priorities, competitor, industry }),
    ]);

    const prompt = buildPrompt({
      company, contact, industry, companySize,
      competitor, pains, priorities, repNotes,
      qwilrReviews, competitorReviews, notionContent,
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are a senior sales enablement specialist at Qwilr. You produce polished, persuasive, beautifully designed HTML sales documents. Output only valid HTML — no markdown, no explanation, no code fences.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let html = completion.choices[0].message.content.trim();

    // Strip accidental code fences if model adds them
    if (html.startsWith("```")) {
      html = html.replace(/^```(?:html)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    return res.status(200).json({ html });
  } catch (err) {
    console.error("Generate error:", err);
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}

function buildPrompt({
  company, contact, industry, companySize,
  competitor, pains, priorities, repNotes,
  qwilrReviews, competitorReviews, notionContent,
}) {
  const painList = pains?.length
    ? pains.map(p => `• ${p}`).join("\n")
    : "• General proposal inefficiency";

  const priorityList = priorities?.length
    ? priorities.join(" and ")
    : "efficiency and deal velocity";

  const competitorBlock = competitor && competitorReviews?.length > 0
    ? `\nREAL G2 COMPLAINTS ABOUT ${competitor.toUpperCase()} (from verified reviews):\n${competitorReviews.map(r => `• ${r}`).join("\n")}`
    : "";

  const notionBlock = notionContent
    ? `\nNOTION CONTENT (Qwilr internal case studies, battle cards, customer wins — use the most relevant):\n${notionContent}`
    : "\nNo Notion content available — use strong G2 proof points and general Qwilr value propositions.";

  return `Generate a complete, self-contained HTML sales leave-behind document for the following prospect.

PROSPECT CONTEXT:
• Company: ${company}
• Contact: ${contact || "the team"}
• Industry: ${industry || "not specified"}
• Size: ${companySize || "not specified"}
• Currently using: ${competitor || "no specific tool mentioned"}
• Pain points identified in discovery:
${painList}
• Top priorities: ${priorityList}
• Rep notes: ${repNotes || "none"}

QWILR G2 REVIEWS — real verified customer quotes (pick the most contextually relevant 3-4):
${qwilrReviews.map(r => `"${r}"`).join("\n")}
${competitorBlock}
${notionBlock}

DOCUMENT STRUCTURE — build each section in order:
1. Branded header — "Qwilr" wordmark in teal, tagline "Proposals that close deals"
2. Personalized hero — headline: "Why [company] should consider Qwilr" with a 2-sentence opener that reflects their specific pains back empathetically
3. "What we're hearing from you" — 2-3 bullet points mirroring their pain points in their language
4. "How Qwilr solves this" — 3 benefit blocks, each matched to a pain/priority, each with a real G2 customer quote as proof
5. ${competitor && competitor !== "No current tool" && competitor !== "Word / Google Docs"
    ? `"Why teams move on from ${competitor}" — 3 concise bullet points using the competitor G2 data, framed as "what we consistently hear from teams switching" — never attack, just state peer insights`
    : '"Built for modern sales teams" — 3 Qwilr differentiators vs generic document tools'
  }
6. Social proof — 1-2 customer success stories from Notion content (or strong G2 reviews if Notion is sparse). Include company name/role if available.
7. Footer CTA — "Ready to see Qwilr in action?" with a calendly/demo link placeholder styled as a teal button

DESIGN REQUIREMENTS:
• Complete self-contained HTML with all CSS inline or in a <style> tag — zero external dependencies
• Brand colors: teal #1DB8A0, navy #1A3A4A, coral #F25C6E
• Clean, executive-quality design — generous whitespace, clear hierarchy
• Max width 800px, centered, with generous padding
• Section dividers using subtle background alternation or thin borders
• Quote blocks styled distinctively (left border in teal, light background)
• @media print rules so it prints/PDFs cleanly — hide nothing, ensure page breaks are sensible
• Professional enough that a rep would be proud to send this to a VP or C-suite contact
• Do NOT use any external image URLs — use CSS shapes or text for any visual elements

Output ONLY the complete HTML document starting with <!DOCTYPE html>. Nothing else.`;
}
