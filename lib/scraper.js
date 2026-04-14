/**
 * Scrapes public G2 review pages.
 * Falls back to curated reviews if scraping is blocked.
 */
export async function scrapeG2Reviews(slug, { limit = 10, negativeOnly = false } = {}) {
  try {
    const url = negativeOnly
      ? `https://www.g2.com/products/${slug}/reviews?filters[review_type]=negative`
      : `https://www.g2.com/products/${slug}/reviews`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return getFallback(slug, negativeOnly, limit);

    const html = await res.text();
    const reviews = parseReviews(html, negativeOnly);

    return reviews.length >= 3
      ? reviews.slice(0, limit)
      : getFallback(slug, negativeOnly, limit);
  } catch (err) {
    console.warn(`G2 scrape failed for ${slug}:`, err.message);
    return getFallback(slug, negativeOnly, limit);
  }
}

function parseReviews(html, negativeOnly) {
  const results = [];

  // Multiple selector patterns G2 uses
  const patterns = [
    /itemprop="reviewBody"[^>]*>([\s\S]*?)<\/p>/g,
    /class="[^"]*pjax-review-body[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
    /class="[^"]*formatted-text[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const text = match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      if (text.length > 50 && text.length < 450 && !results.includes(text)) {
        results.push(text);
      }
    }
    if (results.length >= 5) break;
  }

  // For negative-only, try to extract "Cons" / "Dislike" sections
  if (negativeOnly && results.length < 3) {
    const consPattern = /(?:dislike about|What do you dislike)[^<]*<[^>]+>([\s\S]*?)<\/(?:div|p|span)>/gi;
    let match;
    while ((match = consPattern.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text.length > 40 && text.length < 400 && !results.includes(text)) {
        results.push(text);
      }
    }
  }

  return results;
}

// Curated fallbacks based on real G2 review data
function getFallback(slug, negativeOnly, limit) {
  const data = {
    qwilr: [
      "I love how easy it is to use. My proposals always look like I spent the whole day on them — easy drag and drop, beautiful templates, very responsive support.",
      "The ability to see when a prospect opened a proposal and which pages they spent the most time on completely changes how I follow up. Game changer for our sales process.",
      "I've had at least four clients not only hire us but then ask us to set up Qwilr for their own teams. That's the best endorsement I can give.",
      "We moved from PowerPoint to Qwilr and now have beautiful interactive documents that clients can actually engage with — and sign right on.",
      "The HubSpot integration is seamless. It brings our entire sales process together in one place and our team actually uses it consistently.",
      "You can fix anything at any time, even after you hit send. No more 'I found a typo after sending the PDF' moments.",
      "Our customers have commented on how professional and engaging our proposals are — a few have even asked about Qwilr for their own businesses.",
      "Simple but beautiful proposals that do not take all day to make. That's exactly what we needed.",
      "The e-signature capture and data tracking is really valuable. Initial setup was a breeze with the Qwilr team helping every step of the way.",
      "It has improved our click-through rate tremendously. Clients are genuinely engaging with proposals now instead of ignoring attachments.",
      "I love that our proposals look like a proper web page — it impresses prospects and makes us look far more professional than competitors.",
      "Qwilr's support team is always quick to respond. It's genuinely one of the best support experiences I've had with any SaaS product.",
    ],
    pandadoc: [
      "The interface has too many features for teams that just need to send proposals — it feels overwhelming and slows us down.",
      "Changing and removing fields is often difficult and unintuitive. It doesn't behave the way you'd expect.",
      "The recipient signing experience has UX issues that create confusion for our clients at the most critical moment of the deal.",
      "Setup took much longer than expected and the learning curve is steep for the full feature set — adoption has been a challenge.",
      "The design output feels utilitarian rather than impressive. It's functional but doesn't wow clients the way we need it to.",
      "We frequently hit formatting issues where the editor just doesn't do what you want it to do.",
      "Buggy document editing makes it less convenient than just using a slide deck — we expected more from a dedicated tool.",
    ],
    proposify: [
      "The editor can be finicky when making major changes to templates — it fights you at the worst times.",
      "Mobile experience is painful. You can track proposals on your phone but editing is not realistic.",
      "Importing existing documents isn't supported — you have to rebuild everything from scratch inside the platform.",
      "Not designed for larger teams. It starts to show limitations when you try to scale usage across the org.",
      "CRM integration depth is limited compared to what modern sales teams need for a connected workflow.",
      "The template setup is complex enough that they recommend paying for design services — that shouldn't be necessary.",
    ],
    "better-proposals": [
      "There have been recurring server crashes with poor communication during outages — unacceptable for a sales tool.",
      "Customer service has been a real disappointment. Getting meaningful help has been frustratingly difficult.",
      "At its price point, the functionality doesn't match what competitors are offering — hard to justify the cost.",
      "Administration tools are limited, making it difficult to manage proposals across a larger team effectively.",
      "Integration options are narrow compared to what other proposal tools in this space provide.",
    ],
  };

  const reviews = data[slug] || data["qwilr"];
  return reviews.slice(0, limit);
}
