// Static company data for reliable enrichment.
// Keyed by lowercase company name AND domain (without protocol/www).
// Updated April 2026.

export interface CompanyInfo {
  funding_stage: string | null;
  total_raised: string | null;
  total_employees: number | null;
  headquarters: string | null;
  year_founded: number | null;
  key_investors: string | null;
  ceo_name: string | null;
  linkedin_url: string | null;
  glassdoor_rating: number | null;
  competitors: string | null;
  revenue_stage: string | null;
}

const DATA: Record<string, CompanyInfo> = {
  // ─── Anthropic ──────────────────────────────────────────────────
  anthropic: {
    funding_stage: "Series D+",
    total_raised: "$11.5B",
    total_employees: 1500,
    headquarters: "San Francisco, CA",
    year_founded: 2021,
    key_investors: "Amazon, Google, Spark Capital, Salesforce Ventures, Menlo Ventures",
    ceo_name: "Dario Amodei",
    linkedin_url: "https://www.linkedin.com/company/anthropicresearch",
    glassdoor_rating: 4.4,
    competitors: "OpenAI, Mistral AI, xAI, Google DeepMind",
    revenue_stage: "$100M+ ARR",
  },

  // ─── OpenAI ─────────────────────────────────────────────────────
  openai: {
    funding_stage: "Series D+",
    total_raised: "$17.9B",
    total_employees: 3700,
    headquarters: "San Francisco, CA",
    year_founded: 2015,
    key_investors: "Microsoft, Thrive Capital, Khosla Ventures, a16z, Tiger Global",
    ceo_name: "Sam Altman",
    linkedin_url: "https://www.linkedin.com/company/openai",
    glassdoor_rating: 4.4,
    competitors: "Anthropic, Mistral AI, xAI, Google DeepMind",
    revenue_stage: "$100M+ ARR",
  },

  // ─── Perplexity ─────────────────────────────────────────────────
  perplexity: {
    funding_stage: "Series D+",
    total_raised: "$1.7B",
    total_employees: 250,
    headquarters: "San Francisco, CA",
    year_founded: 2022,
    key_investors: "Jeff Bezos, Nvidia, Databricks, IVP, NEA",
    ceo_name: "Aravind Srinivas",
    linkedin_url: "https://www.linkedin.com/company/perplexity-ai",
    glassdoor_rating: 4.7,
    competitors: "Google Search, ChatGPT, You.com",
    revenue_stage: "$100M+ ARR",
  },

  // ─── Glean ──────────────────────────────────────────────────────
  glean: {
    funding_stage: "Series D+",
    total_raised: "$765M",
    total_employees: 1475,
    headquarters: "Palo Alto, CA",
    year_founded: 2019,
    key_investors: "Sequoia Capital, Kleiner Perkins, Lightspeed, General Catalyst",
    ceo_name: "Arvind Jain",
    linkedin_url: "https://www.linkedin.com/company/gleanwork",
    glassdoor_rating: 4.1,
    competitors: "Coveo, Elastic, Cohere, Sinequa",
    revenue_stage: "$100M+ ARR",
  },

  // ─── Hebbia ─────────────────────────────────────────────────────
  hebbia: {
    funding_stage: "Series B",
    total_raised: "$161M",
    total_employees: 143,
    headquarters: "New York, NY",
    year_founded: 2020,
    key_investors: "Andreessen Horowitz, Index Ventures, Google Ventures, Peter Thiel",
    ceo_name: "George Sivulka",
    linkedin_url: "https://www.linkedin.com/company/hebbia",
    glassdoor_rating: 4.4,
    competitors: "Palantir, Glean, AlphaSense, Kira Systems",
    revenue_stage: "$10-50M ARR",
  },

  // ─── AlphaSense ─────────────────────────────────────────────────
  alphasense: {
    funding_stage: "Series D+",
    total_raised: "$1.4B",
    total_employees: 2000,
    headquarters: "New York, NY",
    year_founded: 2011,
    key_investors: "Viking Global, Goldman Sachs, CapitalG, Alphabet",
    ceo_name: "Jack Kokko",
    linkedin_url: "https://www.linkedin.com/company/alphasense",
    glassdoor_rating: 3.7,
    competitors: "Bloomberg, PitchBook, Tegus, CB Insights, FactSet",
    revenue_stage: "$100M+ ARR",
  },

  // ─── Google DeepMind ────────────────────────────────────────────
  "google deepmind": {
    funding_stage: "Public",
    total_raised: null,
    total_employees: 3000,
    headquarters: "London, UK",
    year_founded: 2010,
    key_investors: "Alphabet/Google (parent company)",
    ceo_name: "Demis Hassabis",
    linkedin_url: "https://www.linkedin.com/company/googledeepmind",
    glassdoor_rating: 4.2,
    competitors: "OpenAI, Anthropic, Meta FAIR, Microsoft Research",
    revenue_stage: null,
  },

  // ─── Mercor ─────────────────────────────────────────────────────
  mercor: {
    funding_stage: "Series C",
    total_raised: "$519M",
    total_employees: 300,
    headquarters: "San Francisco, CA",
    year_founded: 2023,
    key_investors: "Felicis Ventures, Benchmark, General Catalyst, Peter Thiel",
    ceo_name: "Brendan Foody",
    linkedin_url: "https://www.linkedin.com/company/mercor-ai",
    glassdoor_rating: 3.8,
    competitors: "Scale AI, Surge AI, Labelbox, Upwork, Toptal",
    revenue_stage: "$100M+ ARR",
  },

  // ─── Datasite ───────────────────────────────────────────────────
  datasite: {
    funding_stage: "PE-backed",
    total_raised: "$2B",
    total_employees: 1435,
    headquarters: "Minneapolis, MN",
    year_founded: 1968,
    key_investors: "CapVest, ICG",
    ceo_name: "Rusty Wiley",
    linkedin_url: "https://www.linkedin.com/company/datasiteglobal",
    glassdoor_rating: 3.7,
    competitors: "Intralinks, Ideals, Ansarada, SecureDocs",
    revenue_stage: "$100M+ ARR",
  },

  // ─── Grata ──────────────────────────────────────────────────────
  grata: {
    funding_stage: "Series B",
    total_raised: "$35M",
    total_employees: 196,
    headquarters: "New York, NY",
    year_founded: 2016,
    key_investors: "Accomplice VC, Altai Ventures, Bling Capital",
    ceo_name: "Andrew Bocskocsky",
    linkedin_url: "https://www.linkedin.com/company/grata-data",
    glassdoor_rating: 4.6,
    competitors: "SourceScrub, PitchBook, Crunchbase, PrivCo",
    revenue_stage: "$10-50M ARR",
  },

  // ─── SourceScrub ────────────────────────────────────────────────
  sourcescrub: {
    funding_stage: "PE-backed",
    total_raised: null,
    total_employees: 40,
    headquarters: "San Francisco, CA",
    year_founded: 2015,
    key_investors: "Francisco Partners, Mainsail Partners",
    ceo_name: "Prescott Nasser",
    linkedin_url: "https://www.linkedin.com/company/sourcescrub",
    glassdoor_rating: 4.2,
    competitors: "Grata, Inven, Gain.pro, PitchBook",
    revenue_stage: "$10-50M ARR",
  },

  // ─── Daloopa ────────────────────────────────────────────────────
  daloopa: {
    funding_stage: "Series B",
    total_raised: "$55.9M",
    total_employees: 200,
    headquarters: "New York, NY",
    year_founded: 2019,
    key_investors: "Touring Capital, Morgan Stanley, Nexus Venture Partners",
    ceo_name: "Thomas Li",
    linkedin_url: "https://www.linkedin.com/company/daloopa",
    glassdoor_rating: 3.0,
    competitors: "Visible Alpha, Canalyst, ABBYY",
    revenue_stage: "$10-50M ARR",
  },

  // ─── Trove AI ───────────────────────────────────────────────────
  troveai: {
    funding_stage: "Seed",
    total_raised: "$9M",
    total_employees: 24,
    headquarters: "San Francisco, CA",
    year_founded: 2023,
    key_investors: "Menlo Ventures, Khosla Ventures",
    ceo_name: "Danny Goldman",
    linkedin_url: "https://www.linkedin.com/company/trove-ai",
    glassdoor_rating: null,
    competitors: "Rogo, BlueFlame AI, Clarum, F2",
    revenue_stage: "$1-10M ARR",
  },

  // ─── 9fin ───────────────────────────────────────────────────────
  "9fin": {
    funding_stage: "Series C",
    total_raised: "$250M",
    total_employees: 444,
    headquarters: "London, UK",
    year_founded: 2016,
    key_investors: "HarbourVest, CPP Investments, Highland Europe, Spark Capital",
    ceo_name: "Steven Hunter",
    linkedin_url: "https://www.linkedin.com/company/9fin",
    glassdoor_rating: 3.9,
    competitors: "Bloomberg, PitchBook LCD, Debtwire, Reorg",
    revenue_stage: "$50-100M ARR",
  },

  // ─── BlueFlame AI ──────────────────────────────────────────────
  "blueflame ai": {
    funding_stage: "Series A",
    total_raised: "$5M",
    total_employees: 30,
    headquarters: "New York, NY",
    year_founded: 2023,
    key_investors: "Kareya",
    ceo_name: "Raj Bakhru",
    linkedin_url: "https://www.linkedin.com/company/blueflameai",
    glassdoor_rating: null,
    competitors: "Rogo, Finster, Model ML, Clarum",
    revenue_stage: "$1-10M ARR",
  },

  // ─── Clarum ─────────────────────────────────────────────────────
  clarum: {
    funding_stage: "Seed",
    total_raised: "$500K",
    total_employees: 3,
    headquarters: "San Francisco, CA",
    year_founded: 2023,
    key_investors: "Y Combinator",
    ceo_name: "Anton Otaner",
    linkedin_url: "https://www.linkedin.com/company/clarum-ai",
    glassdoor_rating: null,
    competitors: "DiligenceVault, Rogo, BlueFlame AI",
    revenue_stage: "Pre-revenue",
  },

  // ─── F2 ─────────────────────────────────────────────────────────
  f2: {
    funding_stage: "Seed",
    total_raised: "$10M",
    total_employees: 20,
    headquarters: "New York, NY",
    year_founded: 2025,
    key_investors: "NFX, Left Lane Capital, Torch Capital, Y Combinator",
    ceo_name: "Don Muir",
    linkedin_url: "https://www.linkedin.com/company/f2-ai",
    glassdoor_rating: null,
    competitors: "Rogo, Farsight, Finster, Model ML",
    revenue_stage: "<$1M ARR",
  },

  // ─── Farsight ───────────────────────────────────────────────────
  farsight: {
    funding_stage: "Series A",
    total_raised: "$16M",
    total_employees: 25,
    headquarters: "New York, NY",
    year_founded: 2022,
    key_investors: "SignalFire, RRE Ventures, Link Ventures",
    ceo_name: "Samir Dutta",
    linkedin_url: "https://www.linkedin.com/company/farsight-ai",
    glassdoor_rating: null,
    competitors: "Hebbia, Rogo, Finster, Model ML",
    revenue_stage: "$1-10M ARR",
  },

  // ─── Finster ────────────────────────────────────────────────────
  finster: {
    funding_stage: "Series A",
    total_raised: "$31.8M",
    total_employees: 25,
    headquarters: "London, UK",
    year_founded: 2023,
    key_investors: "FinTech Collective, Peak XV, Hoxton Ventures",
    ceo_name: "Sid Jayakumar",
    linkedin_url: "https://www.linkedin.com/company/finster-ai",
    glassdoor_rating: null,
    competitors: "AlphaSense, Accelex, Rogo",
    revenue_stage: "$1-10M ARR",
  },

  // ─── Gain ───────────────────────────────────────────────────────
  gain: {
    funding_stage: "Seed",
    total_raised: "$10M",
    total_employees: 300,
    headquarters: "Amsterdam, Netherlands",
    year_founded: 2018,
    key_investors: null,
    ceo_name: "Frister Haveman",
    linkedin_url: "https://www.linkedin.com/company/gain-pro",
    glassdoor_rating: null,
    competitors: "PitchBook, Grata, SourceScrub, Inven, Dealroom",
    revenue_stage: "$10-50M ARR",
  },

  // ─── Grasp ──────────────────────────────────────────────────────
  grasp: {
    funding_stage: "Series A",
    total_raised: "$9M",
    total_employees: 30,
    headquarters: "Stockholm, Sweden",
    year_founded: 2020,
    key_investors: "Octopus Ventures, Yanno Capital",
    ceo_name: "Richard Karlsson",
    linkedin_url: "https://www.linkedin.com/company/grasp-intelligence",
    glassdoor_rating: null,
    competitors: "Rogo, Model ML, Finster, Farsight",
    revenue_stage: "$1-10M ARR",
  },

  // ─── Inven ──────────────────────────────────────────────────────
  inven: {
    funding_stage: "Series A",
    total_raised: "$14.4M",
    total_employees: 100,
    headquarters: "Helsinki, Finland",
    year_founded: 2022,
    key_investors: "Lifeline Ventures, Vendep Capital, Ventech",
    ceo_name: "Ekku Jokinen",
    linkedin_url: "https://www.linkedin.com/company/inven-ai",
    glassdoor_rating: null,
    competitors: "PitchBook, Crunchbase, CB Insights, Grata",
    revenue_stage: "$1-10M ARR",
  },

  // ─── Junior ─────────────────────────────────────────────────────
  junior: {
    funding_stage: "Seed",
    total_raised: "$400K",
    total_employees: 10,
    headquarters: "New York, NY",
    year_founded: 2022,
    key_investors: "South Park Commons",
    ceo_name: "Dimitris Samouris",
    linkedin_url: "https://www.linkedin.com/company/myjunior",
    glassdoor_rating: null,
    competitors: "Rogo, Hebbia, AlphaSense",
    revenue_stage: "<$1M ARR",
  },

  // ─── Listen Labs ────────────────────────────────────────────────
  "listen labs": {
    funding_stage: "Series B",
    total_raised: "$100M",
    total_employees: 50,
    headquarters: "San Francisco, CA",
    year_founded: 2023,
    key_investors: "Sequoia Capital, Ribbit Capital, Conviction, Pear VC",
    ceo_name: "Alfred Wahlforss",
    linkedin_url: "https://www.linkedin.com/company/listenlabss",
    glassdoor_rating: null,
    competitors: "Qualtrics, UserTesting, dscout",
    revenue_stage: "$10-50M ARR",
  },

  // ─── Model ML ───────────────────────────────────────────────────
  modelml: {
    funding_stage: "Series A",
    total_raised: "$87.5M",
    total_employees: 80,
    headquarters: "New York, NY",
    year_founded: 2024,
    key_investors: "FT Partners, Y Combinator, QED, LocalGlobe",
    ceo_name: "Chaz Englander",
    linkedin_url: "https://www.linkedin.com/company/model-ml",
    glassdoor_rating: null,
    competitors: "Rogo, Finster, Farsight, Grasp",
    revenue_stage: "$1-10M ARR",
  },

  // ─── OffDeal ────────────────────────────────────────────────────
  offdeal: {
    funding_stage: "Series A",
    total_raised: "$17M",
    total_employees: 20,
    headquarters: "New York, NY",
    year_founded: 2023,
    key_investors: "Radical Ventures, Y Combinator, Rebel Fund",
    ceo_name: "Ori Eldarov",
    linkedin_url: "https://www.linkedin.com/company/offdeal",
    glassdoor_rating: null,
    competitors: "Teamshares, Acquire.com, Grata, SourceScrub",
    revenue_stage: "<$1M ARR",
  },

  // ─── Rogo ───────────────────────────────────────────────────────
  rogo: {
    funding_stage: "Series C",
    total_raised: "$165M",
    total_employees: 100,
    headquarters: "New York, NY",
    year_founded: 2022,
    key_investors: "Sequoia Capital, Thrive Capital, Khosla Ventures, Tiger Global, J.P. Morgan",
    ceo_name: "Gabriel Stengel",
    linkedin_url: "https://www.linkedin.com/company/rogoai",
    glassdoor_rating: null,
    competitors: "Hebbia, AlphaSense, Finster, Model ML",
    revenue_stage: "$10-50M ARR",
  },

  // ─── Saphyre ────────────────────────────────────────────────────
  saphyre: {
    funding_stage: "PE-backed",
    total_raised: "$92.7M",
    total_employees: 105,
    headquarters: "Hoboken, NJ",
    year_founded: 2017,
    key_investors: "FTV Capital, BNP Paribas, J.P. Morgan",
    ceo_name: "Gabino Roche Jr.",
    linkedin_url: "https://www.linkedin.com/company/saphyre",
    glassdoor_rating: null,
    competitors: "IPC, Clear Street, FactSet, Numerix",
    revenue_stage: "$10-50M ARR",
  },
};

// ─── Domain-to-key mapping ────────────────────────────────────────
// Maps cleaned domain names to lookup keys in DATA
const DOMAIN_MAP: Record<string, string> = {
  "anthropic.com": "anthropic",
  "openai.com": "openai",
  "perplexity.ai": "perplexity",
  "glean.com": "glean",
  "hebbia.com": "hebbia",
  "alpha-sense.com": "alphasense",
  "deepmind.google": "google deepmind",
  "mercor.com": "mercor",
  "datasite.com": "datasite",
  "grata.com": "grata",
  "sourcescrub.com": "sourcescrub",
  "daloopa.com": "daloopa",
  "troveai.co": "troveai",
  "9fin.com": "9fin",
  "blueflame.ai": "blueflame ai",
  "clarum.ai": "clarum",
  "f2.ai": "f2",
  "farsight.ai": "farsight",
  "finster.ai": "finster",
  "gain.ai": "gain",
  "grasp.co": "grasp",
  "inven.ai": "inven",
  "myjunior.ai": "junior",
  "listenlabs.com": "listen labs",
  "modelml.com": "modelml",
  "offdeal.com": "offdeal",
  "rogo.ai": "rogo",
  "saphyre.com": "saphyre",
};

function cleanDomain(website: string): string {
  return website
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .toLowerCase();
}

/**
 * Look up company data by name and/or website domain.
 * Returns matching CompanyInfo or null if not found.
 */
export function lookupCompanyData(
  name: string,
  website?: string | null
): CompanyInfo | null {
  // Try domain first (most reliable)
  if (website) {
    const domain = cleanDomain(website);
    const key = DOMAIN_MAP[domain];
    if (key && DATA[key]) return DATA[key];
  }

  // Try lowercase name
  const lower = name.toLowerCase().trim();
  if (DATA[lower]) return DATA[lower];

  // Try with common suffixes stripped
  const stripped = lower
    .replace(/\s*(ai|io|inc|co|labs|hq|tech)$/i, "")
    .trim();
  if (stripped !== lower && DATA[stripped]) return DATA[stripped];

  return null;
}
