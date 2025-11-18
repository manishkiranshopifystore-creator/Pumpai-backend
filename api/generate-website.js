// api/generate-website.js
// Vercel serverless function that calls Groq to generate website content

const SYSTEM_PROMPT = `You are a Solana degen copywriter and UX writer for meme coin websites.

You will be given:
- project_name: name of the coin
- ticker: token ticker (e.g. "PUMP")
- vibe: tone style (e.g. "degen", "cute", "frog", "ai", "simple")
- optional_note: any extra info from the user

Return ONLY a valid JSON object in this format, with no extra text:

{
  "theme": "",
  "hero_title": "",
  "hero_subtitle": "",
  "tagline": "",
  "features": [
    { "title": "", "description": "" },
    { "title": "", "description": "" },
    { "title": "", "description": "" }
  ],
  "lore_paragraphs": [
    "",
    "",
    ""
  ],
  "tokenomics_points": [
    "",
    "",
    ""
  ],
  "roadmap_phases": [
    { "title": "", "description": "" },
    { "title": "", "description": "" },
    { "title": "", "description": "" }
  ],
  "faq": [
    { "question": "", "answer": "" },
    { "question": "", "answer": "" },
    { "question": "", "answer": "" },
    { "question": "", "answer": "" }
  ]
}

Rules:
- hero_title must be short (3–7 words)
- hero_subtitle must be one short sentence
- tagline must be under 12 words
- features array must contain 3 items
- lore_paragraphs must contain 2–3 items
- tokenomics_points must contain 3 items
- roadmap_phases must contain 3 items
- faq must contain 4 items

Add rules for the new "theme" field:
- The theme must be one of: "frog", "ai", "cute", "degen", "simple".
- Select theme based on project_name, ticker, and vibe:
  - If project references frogs, pepe, hop → theme = "frog"
  - If project references robots/AI/tech → theme = "ai"
  - If project sounds cute/adorable → theme = "cute"
  - If project is chaotic/hype/meme → theme = "degen"
  - Otherwise → theme = "simple"

Tone:
- vibe = "degen": more degen slang but still readable.
- vibe = "cute": playful and light.
- vibe = "ai": futuristic and techy.
- vibe = "frog": pepe / frog meme style.
- vibe = "simple": straightforward, clean.

Output must be STRICT JSON.
No markdown, no comments, no additional text outside the JSON object.
`;

export default async function handler(req, res) {
  // Basic CORS so browser tools and Orchid can call it
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { project_name, ticker, vibe, optional_note } = req.body || {};

  if (!project_name || !ticker) {
    res.status(400).json({ error: "project_name and ticker are required" });
    return;
  }

  try {
    const bodyForModel = JSON.stringify({
      project_name,
      ticker,
      vibe: vibe || "degen",
      optional_note: optional_note || ""
    });

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", // or any Groq chat model
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: bodyForModel }
          ],
          temperature: 0.8
        })
      }
    );

    const data = await groqResponse.json();

    // Extract the raw text
    let rawText = data?.choices?.[0]?.message?.content || "{}";

    // Clean common wrappers like ```json ... ```
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```[a-zA-Z]*/g, "").replace(/```/g, "").trim();
    }

    // Keep only the content between the first "{" and last "}"
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let json;
    try {
      json = JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse JSON from Groq:", cleaned);
      res.status(500).json({ error: "AI returned invalid JSON", rawText: cleaned });
      return;
    }

    res.status(200).json(json);
  } catch (err) {
    console.error("Groq API error:", err);
    res.status(500).json({ error: "Failed to generate website content" });
  }
}
