type EbayEnvironment = "sandbox" | "production";

interface EbayConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  marketplaceId: string;
  merchantLocationKey: string;
  categoryId: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  environment: EbayEnvironment;
  currency: string;
}

interface EbayAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface PublishVinylInput {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  price: number;
  condition: string;
  cover_url: string | null;
  available: boolean;
}

interface EbayPublishResult {
  offerId: string;
  listingId?: string;
}

function getConfig(): EbayConfig {
  const environment = (process.env.EBAY_ENVIRONMENT || "sandbox") as EbayEnvironment;

  return {
    clientId: process.env.EBAY_CLIENT_ID || "",
    clientSecret: process.env.EBAY_CLIENT_SECRET || "",
    refreshToken: process.env.EBAY_REFRESH_TOKEN || "",
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_IT",
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY || "",
    categoryId: process.env.EBAY_CATEGORY_ID || "176985",
    fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID || "",
    paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID || "",
    returnPolicyId: process.env.EBAY_RETURN_POLICY_ID || "",
    environment,
    currency: process.env.EBAY_CURRENCY || "EUR",
  };
}

export function getMissingEbayConfigKeys(): string[] {
  const config = getConfig();
  const entries: Array<[keyof EbayConfig, string]> = [
    ["clientId", config.clientId],
    ["clientSecret", config.clientSecret],
    ["refreshToken", config.refreshToken],
    ["marketplaceId", config.marketplaceId],
    ["merchantLocationKey", config.merchantLocationKey],
    ["categoryId", config.categoryId],
    ["fulfillmentPolicyId", config.fulfillmentPolicyId],
    ["paymentPolicyId", config.paymentPolicyId],
    ["returnPolicyId", config.returnPolicyId],
  ];

  return entries.filter(([, value]) => !value).map(([key]) => key);
}

function getBaseUrl(environment: EbayEnvironment): string {
  return environment === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";
}

function toEbayCondition(condition: string): string {
  const normalized = condition.toLowerCase();

  if (normalized.includes("mint") || normalized.includes("near mint")) {
    return "NEW";
  }

  if (normalized.includes("very good")) {
    return "USED_VERY_GOOD";
  }

  if (normalized.includes("good")) {
    return "USED_GOOD";
  }

  if (normalized.includes("fair") || normalized.includes("poor")) {
    return "USED_ACCEPTABLE";
  }

  return "USED_GOOD";
}

function sanitizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

async function getAccessToken(config: EbayConfig): Promise<string> {
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const scope = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.account",
  ].join(" ");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
    scope,
  });

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });

  const data = (await res.json()) as EbayAccessTokenResponse & { error_description?: string };

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || "Impossibile ottenere access token eBay");
  }

  return data.access_token;
}

export async function publishVinylToEbay(input: PublishVinylInput): Promise<EbayPublishResult> {
  const config = getConfig();
  const missing = getMissingEbayConfigKeys();

  if (missing.length > 0) {
    throw new Error(`Configurazione eBay incompleta: ${missing.join(", ")}`);
  }

  if (!input.available) {
    throw new Error("Il vinile non e disponibile, pubblicazione eBay saltata");
  }

  const token = await getAccessToken(config);
  const baseUrl = getBaseUrl(config.environment);
  const sku = `vinyl-${input.id}`;

  const inventoryRes = await fetch(`${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Language": "it-IT",
    },
    body: JSON.stringify({
      condition: toEbayCondition(input.condition),
      locale: "it_IT",
      product: {
        title: sanitizeTitle(`${input.artist} - ${input.title}`),
        description: input.description || `${input.title} di ${input.artist}. Vinile usato in buone condizioni.`,
        imageUrls: input.cover_url ? [input.cover_url] : undefined,
        aspects: {
          Format: ["Record"],
          Artist: [input.artist],
        },
      },
      availability: {
        shipToLocationAvailability: {
          quantity: 1,
        },
      },
    }),
  });

  if (!inventoryRes.ok) {
    const errorText = await inventoryRes.text();
    throw new Error(`Errore inventory item eBay: ${errorText}`);
  }

  const offerRes = await fetch(`${baseUrl}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Language": "it-IT",
    },
    body: JSON.stringify({
      sku,
      marketplaceId: config.marketplaceId,
      format: "FIXED_PRICE",
      availableQuantity: 1,
      categoryId: config.categoryId,
      merchantLocationKey: config.merchantLocationKey,
      listingDescription: input.description || `${input.title} di ${input.artist}.`,
      pricingSummary: {
        price: {
          value: Number(input.price).toFixed(2),
          currency: config.currency,
        },
      },
      listingPolicies: {
        fulfillmentPolicyId: config.fulfillmentPolicyId,
        paymentPolicyId: config.paymentPolicyId,
        returnPolicyId: config.returnPolicyId,
      },
    }),
  });

  const offerData = (await offerRes.json()) as { offerId?: string; errors?: Array<{ message: string }> };

  if (!offerRes.ok || !offerData.offerId) {
    const firstError = offerData.errors?.[0]?.message;
    throw new Error(firstError || "Errore creazione offerta eBay");
  }

  const publishRes = await fetch(`${baseUrl}/sell/inventory/v1/offer/${offerData.offerId}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Language": "it-IT",
    },
  });

  const publishData = (await publishRes.json()) as { listingId?: string; errors?: Array<{ message: string }> };

  if (!publishRes.ok) {
    const firstError = publishData.errors?.[0]?.message;
    throw new Error(firstError || "Errore pubblicazione offerta eBay");
  }

  return {
    offerId: offerData.offerId,
    listingId: publishData.listingId,
  };
}
