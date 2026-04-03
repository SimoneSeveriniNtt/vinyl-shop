import { NextRequest, NextResponse } from "next/server";

const PROVINCE_CODES: Record<string, string> = {
  Agrigento: "AG",
  Alessandria: "AL",
  Ancona: "AN",
  Aosta: "AO",
  "Arezzo": "AR",
  "Ascoli Piceno": "AP",
  Asti: "AT",
  Avellino: "AV",
  Bari: "BA",
  Barletta: "BT",
  Belluno: "BL",
  Benevento: "BN",
  Bergamo: "BG",
  Biella: "BI",
  Bologna: "BO",
  Bolzano: "BZ",
  Brescia: "BS",
  Brindisi: "BR",
  Cagliari: "CA",
  Caltanissetta: "CL",
  Campobasso: "CB",
  Caserta: "CE",
  Catania: "CT",
  Catanzaro: "CZ",
  Chieti: "CH",
  Como: "CO",
  Cosenza: "CS",
  Cremona: "CR",
  Crotone: "KR",
  Cuneo: "CN",
  Enna: "EN",
  Fermo: "FM",
  Ferrara: "FE",
  Firenze: "FI",
  Foggia: "FG",
  "Forlì-Cesena": "FC",
  Frosinone: "FR",
  Genova: "GE",
  Gorizia: "GO",
  Grosseto: "GR",
  Imperia: "IM",
  Isernia: "IS",
  "L'Aquila": "AQ",
  LaSpezia: "SP",
  Latina: "LT",
  Lecce: "LE",
  Lecco: "LC",
  Livorno: "LI",
  Lodi: "LO",
  Lucca: "LU",
  Macerata: "MC",
  Mantova: "MN",
  MassaCarrara: "MS",
  Matera: "MT",
  Messina: "ME",
  Milano: "MI",
  Modena: "MO",
  MonzaBrianza: "MB",
  Napoli: "NA",
  Novara: "NO",
  Nuoro: "NU",
  Oristano: "OR",
  Padova: "PD",
  Palermo: "PA",
  Parma: "PR",
  Pavia: "PV",
  Perugia: "PG",
  PesaroUrbino: "PU",
  Pescara: "PE",
  Piacenza: "PC",
  Pisa: "PI",
  Pistoia: "PT",
  Pordenone: "PN",
  Potenza: "PZ",
  Prato: "PO",
  Ragusa: "RG",
  Ravenna: "RA",
  ReggioCalabria: "RC",
  ReggioEmilia: "RE",
  Rieti: "RI",
  Rimini: "RN",
  Roma: "RM",
  Rovigo: "RO",
  Salerno: "SA",
  Sassari: "SS",
  Savona: "SV",
  Siena: "SI",
  Siracusa: "SR",
  Sondrio: "SO",
  Taranto: "TA",
  Teramo: "TE",
  Terni: "TR",
  Torino: "TO",
  Trapani: "TP",
  Trento: "TN",
  Treviso: "TV",
  Trieste: "TS",
  Udine: "UD",
  Varese: "VA",
  Venezia: "VE",
  "Verbano-Cusio-Ossola": "VB",
  Vercelli: "VC",
  Verona: "VR",
  "Vibo Valentia": "VV",
  Vicenza: "VI",
  Viterbo: "VT",
  SudSardegna: "SU",
  MonzaedellaBrianza: "MB",
  ForliCesena: "FC",
  PesaroeUrbino: "PU",
  ReggionellEmilia: "RE",
  ReggioDiCalabria: "RC",
  VerbanoCusioOssola: "VB",
  ViboValentia: "VV",
  Laspezia: "SP",
  Aquila: "AQ",
  MonzaDellaBrianza: "MB",
  CarboniaIglesias: "SU",
  Ogliastra: "NU",
  OlbiaTempio: "SS",
  MedioCampidano: "SU",
};

function normalizeProvinceName(value: string | undefined) {
  if (!value) return "";

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/citta metropolitana di /gi, "")
    .replace(/provincia di /gi, "")
    .replace(/libero consorzio comunale di /gi, "")
    .replace(/ /g, "")
    .replace(/-/g, "")
    .replace(/'/g, "")
    .trim();
}

function getProvinceCode(address: Record<string, string>) {
  const provinceCandidates = [
    address.county,
    address.state_district,
    address.province,
    address.state,
  ];

  for (const candidate of provinceCandidates) {
    if (candidate && /^[A-Z]{2}$/.test(candidate.trim())) {
      return candidate.trim().toUpperCase();
    }

    const normalized = normalizeProvinceName(candidate);
    if (normalized && PROVINCE_CODES[normalized]) {
      return PROVINCE_CODES[normalized];
    }
  }

  return "";
}

function buildAddressLine(displayName: string, address: Record<string, string>) {
  if (address.road && address.house_number) {
    return `${address.road} ${address.house_number}`;
  }

  if (address.road) {
    const parts = displayName.split(",").map((part) => part.trim()).filter(Boolean);
    const firstPart = parts[0] || "";
    const secondPart = parts[1] || "";

    // Nominatim often returns either:
    // - "Via Roma, 35, Milano..."
    // - "35, Via Roma, Milano..."
    if (/^\d+[A-Za-z/-]*$/.test(secondPart)) {
      return `${address.road} ${secondPart}`;
    }

    if (/^\d+[A-Za-z/-]*$/.test(firstPart) && secondPart) {
      return `${secondPart} ${firstPart}`;
    }

    if (firstPart && /\d/.test(firstPart) && /via|viale|piazza|corso|largo|vicolo|strada|lungomare|piazzale/i.test(firstPart)) {
      return firstPart;
    }

    return address.road;
  }

  return displayName.split(",").slice(0, 2).join(", ").trim();
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "it");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", `${query}, Italia`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "vinyl-shop-checkout/1.0",
      "Accept-Language": "it-IT,it;q=0.9",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  const results = (await response.json()) as Array<{
    display_name: string;
    address?: Record<string, string>;
  }>;

  const typedHouseNumber = query.match(/(?:^|\s)(\d+[A-Za-z\/-]*)\b/)?.[1] || "";

  const suggestions = results.map((result) => {
    const address = result.address || {};
    const baseAddress = buildAddressLine(result.display_name, address);
    const addressHasHouseNumber = /\d/.test(baseAddress);
    const city = address.city || address.town || address.village || address.municipality || "";
    const province = getProvinceCode(address);
    const cap = address.postcode || "";

    return {
      label: result.display_name,
      address: addressHasHouseNumber
        ? baseAddress
        : (typedHouseNumber ? `${baseAddress} ${typedHouseNumber}` : baseAddress),
      city,
      province,
      cap,
      country: "Italia",
    };
  });

  return NextResponse.json({ suggestions });
}