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
- hero_title: short, bold, 3–7 words.
- hero_subtitle: 1 short sentence that explains the coin or brand.
- tagline: under 12 words, feels like a slogan.
- features: talk about utility, community, AI aspect, Pump.fun readiness, etc.
- lore_paragraphs: 2–3 fun story paragraphs.
- tokenomics_points: mention things like 1B supply, 3% dev, 97% community, 0% tax if relevant.
- roadmap_phases: Phase 1 (launch), Phase 2 (community + memes), Phase 3 (DEX / integrations).
- faq: common degen questions like “Is this a rug?”, “What does {ticker} actually do?”, “How does Pump AI help?”, “Can the buy link change later?”

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
  // Basic CORS so tools / frontends can call it
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
          model: "llama-3.1-8b-instant", // or another Groq chat model
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: bodyForModel }
          ],
          temperature: 0.8
        })
      }
    );

    const data = await groqResponse.json();

    const rawText =
      data?.choices?.[0]?.message?.content?.trim() || "{}";

    let json;
    try {
      json = JSON.parse(rawText);
    } catch (err) {
      console.error("Failed to parse JSON from Groq:", rawText);
      res.status(500).json({ error: "AI returned invalid JSON", rawText });
      return;
    }

    res.status(200).json(json);
  } catch (err) {
    console.error("Groq API error:", err);
    res.status(500).json({ error: "Failed to generate website content" });
  }
}
