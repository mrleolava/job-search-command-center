/**
 * Curated list of Greenhouse, Lever, and Ashby boards in AI/ML, fintech, and SaaS.
 * Used in keyword-only search mode to scan for jobs across these companies
 * without requiring any external API keys.
 */

export interface CuratedBoard {
  name: string;
  board: "greenhouse" | "lever" | "ashby";
  slug: string;
}

export const CURATED_BOARDS: CuratedBoard[] = [
  // ---- AI / ML ----
  { name: "Anthropic", board: "greenhouse", slug: "anthropic" },
  { name: "OpenAI", board: "greenhouse", slug: "openai" },
  { name: "Cohere", board: "greenhouse", slug: "cohere" },
  { name: "Mistral AI", board: "greenhouse", slug: "mistralai" },
  { name: "Hugging Face", board: "greenhouse", slug: "huggingface" },
  { name: "Scale AI", board: "greenhouse", slug: "scaleai" },
  { name: "Perplexity", board: "greenhouse", slug: "perplexityai" },
  { name: "Runway", board: "greenhouse", slug: "runwayml" },
  { name: "Anduril", board: "greenhouse", slug: "andurilindustries" },
  { name: "Cursor", board: "greenhouse", slug: "anysphereai" },
  { name: "Glean", board: "greenhouse", slug: "glaboratories" },
  { name: "Writer", board: "greenhouse", slug: "writer" },
  { name: "Weights & Biases", board: "greenhouse", slug: "wandb" },
  { name: "Cleanlab", board: "greenhouse", slug: "cleanlab" },
  { name: "Pinecone", board: "greenhouse", slug: "pinecone" },
  { name: "Hebbia", board: "greenhouse", slug: "hebbia" },
  { name: "Harvey AI", board: "ashby", slug: "harvey" },
  { name: "Sierra AI", board: "ashby", slug: "sierra" },
  { name: "Ramp", board: "ashby", slug: "ramp" },

  // ---- Fintech ----
  { name: "Stripe", board: "greenhouse", slug: "stripe" },
  { name: "Plaid", board: "lever", slug: "plaid" },
  { name: "Brex", board: "greenhouse", slug: "brex" },
  { name: "Rogo", board: "greenhouse", slug: "rogo" },
  { name: "AlphaSense", board: "greenhouse", slug: "alphasense" },
  { name: "Affirm", board: "greenhouse", slug: "affirm" },
  { name: "Marqeta", board: "greenhouse", slug: "marqeta" },
  { name: "Column", board: "greenhouse", slug: "column" },
  { name: "Mercury", board: "greenhouse", slug: "mercury" },
  { name: "Modernfi", board: "greenhouse", slug: "modernfi" },
  { name: "Alloy", board: "greenhouse", slug: "alloy" },
  { name: "Sardine", board: "greenhouse", slug: "sardine" },
  { name: "Carta", board: "greenhouse", slug: "carta" },
  { name: "Addepar", board: "greenhouse", slug: "addepar" },

  // ---- SaaS / Enterprise ----
  { name: "Figma", board: "greenhouse", slug: "figma" },
  { name: "Notion", board: "greenhouse", slug: "notion" },
  { name: "Vercel", board: "greenhouse", slug: "vercel" },
  { name: "Datadog", board: "greenhouse", slug: "datadog" },
  { name: "Rippling", board: "greenhouse", slug: "rippling" },
  { name: "Retool", board: "greenhouse", slug: "retool" },
  { name: "Neon", board: "greenhouse", slug: "neondatabase" },
  { name: "Linear", board: "lever", slug: "linear" },
  { name: "Supabase", board: "ashby", slug: "supabase" },
  { name: "Grafana Labs", board: "greenhouse", slug: "grafanalabs" },
  { name: "LaunchDarkly", board: "greenhouse", slug: "launchdarkly" },
  { name: "Sourcegraph", board: "greenhouse", slug: "sourcegraph91" },
  { name: "Hex", board: "greenhouse", slug: "hex" },
  { name: "Temporal", board: "greenhouse", slug: "temporaltechnologies" },
  { name: "Airtable", board: "greenhouse", slug: "airtable" },
  { name: "Vanta", board: "greenhouse", slug: "vanta" },
  { name: "Wiz", board: "greenhouse", slug: "wiz" },
  { name: "GitLab", board: "greenhouse", slug: "gitlab" },
  { name: "Confluent", board: "greenhouse", slug: "confluent" },
  { name: "Postman", board: "greenhouse", slug: "postman" },
];
