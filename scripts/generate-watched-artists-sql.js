const fs = require("fs");
const path = require("path");

const categoryArtists = {
  Pop: [
    "Taylor Swift", "Adele", "Billie Eilish", "Dua Lipa", "Olivia Rodrigo", "Ariana Grande", "The Weeknd", "Harry Styles", "Ed Sheeran", "Lady Gaga",
    "Beyonce", "Rihanna", "Justin Bieber", "Shawn Mendes", "Selena Gomez", "Miley Cyrus", "Sabrina Carpenter", "Chappell Roan", "Tate McRae", "Doja Cat",
    "Troye Sivan", "Sam Smith", "Charlie Puth", "Conan Gray", "Lorde", "Katy Perry", "Sia", "Jessie J", "Camila Cabello", "Jennifer Lopez",
    "Annalisa", "Elodie", "Emma", "Alessandra Amoroso", "Noemi", "Arisa", "Francesca Michielin", "Gaia", "Angelina Mango", "Marco Mengoni",
    "Tiziano Ferro", "Laura Pausini", "Elisa", "Ultimo", "Blanco", "Mahmood", "Madame", "Rose Villain", "Rkomi", "Achille Lauro",
  ],
  Rap: [
    "Marracash", "Gu", "Salmo", "Lazza", "Geolier", "Sfera Ebbasta", "Fabri Fibra", "Emis Killa", "Gemitaiz", "MadMan",
    "Nitro", "Clementino", "Noyz Narcos", "Ernia", "Izi", "Tony Effe", "Shiva", "Baby Gang", "Tedua", "Ghali",
    "Massimo Pericolo", "Artie 5ive", "Nayt", "Dani Faiv", "Vegas Jones", "Rocco Hunt", "Giaime", "Bassi Maestro", "Frankie hi-nrg mc", "J Ax",
    "Kendrick Lamar", "Drake", "J Cole", "Eminem", "Jay Z", "Nas", "Travis Scott", "Future", "21 Savage", "Metro Boomin",
    "Lil Baby", "Gunna", "A Boogie Wit da Hoodie", "Lil Durk", "Roddy Ricch", "Tyler The Creator", "A$AP Rocky", "Pusha T", "Denzel Curry", "Freddie Gibbs",
  ],
  "Hip Hop": [
    "A Tribe Called Quest", "De La Soul", "Gang Starr", "The Roots", "Mos Def", "Talib Kweli", "Common", "Method Man", "Redman", "Ghostface Killah",
    "GZA", "Raekwon", "MF DOOM", "Pete Rock", "DJ Premier", "J Dilla", "Mobb Deep", "Cypress Hill", "KRS One", "Big Daddy Kane",
    "Public Enemy", "Beastie Boys", "House of Pain", "Jeru The Damaja", "Joey Bada$$", "Earl Sweatshirt", "Vince Staples", "Logic", "Lupe Fiasco", "Little Simz",
    "Run The Jewels", "Danny Brown", "Aesop Rock", "Brother Ali", "Atmosphere", "People Under The Stairs", "Jurassic 5", "Black Star", "Souls of Mischief", "The Pharcyde",
    "Caparezza", "Ensi", "Tormento", "Inoki", "Kaos One", "Coez", "Carl Brave", "Mostro", "Mecna", "Claver Gold",
  ],
  Rock: [
    "Foo Fighters", "Arctic Monkeys", "Muse", "Queens of the Stone Age", "The Killers", "Pearl Jam", "Red Hot Chili Peppers", "Green Day", "The Strokes", "The Black Keys",
    "Royal Blood", "Nothing But Thieves", "Imagine Dragons", "Maneskin", "Vasco Rossi", "Ligabue", "Negramaro", "Subsonica", "Afterhours", "Marlene Kuntz",
    "Litfiba", "Verdena", "Zen Circus", "Fast Animals and Slow Kids", "Editors", "Interpol", "Placebo", "Radiohead", "Coldplay", "U2",
    "The Rolling Stones", "The Who", "Deep Purple", "Led Zeppelin", "AC DC", "Black Sabbath", "Iron Maiden", "Metallica", "Ghost", "Bring Me The Horizon",
    "Sleep Token", "Idles", "Fontaines D C", "Wolf Alice", "Pavement", "Sonic Youth", "Dinosaur Jr", "Built To Spill", "The War On Drugs", "Kings of Leon",
  ],
  Indie: [
    "Bon Iver", "Sufjan Stevens", "Phoebe Bridgers", "Boygenius", "Japanese Breakfast", "Snail Mail", "Soccer Mommy", "Alvvays", "Beach House", "Clairo",
    "Weyes Blood", "Mitski", "Angel Olsen", "St Vincent", "Mac DeMarco", "Tame Impala", "King Gizzard and the Lizard Wizard", "Unknown Mortal Orchestra", "Khruangbin", "Cigarettes After Sex",
    "The National", "Wilco", "Spoon", "Yo La Tengo", "Slowdive", "Mogwai", "Explosions in the Sky", "Sigur Ros", "Grizzly Bear", "Fleet Foxes",
    "Arcade Fire", "Death Cab For Cutie", "The xx", "Alt J", "The 1975", "Belle and Sebastian", "Car Seat Headrest", "Protomartyr", "Shame", "Black Midi",
    "Calcutta", "Gazzelle", "Pinguini Tattici Nucleari", "Willie Peyote", "Dente", "Brunori Sas", "Motta", "I Cani", "Colapesce", "Dimartino",
  ],
  Electronic: [
    "Daft Punk", "The Chemical Brothers", "Underworld", "Aphex Twin", "Autechre", "Boards of Canada", "Burial", "Four Tet", "Jon Hopkins", "Floating Points",
    "Bicep", "Moderat", "Bonobo", "Caribou", "Flume", "Jamie xx", "Fred again", "Disclosure", "Peggy Gou", "Charlotte de Witte",
    "Amelie Lens", "Nina Kraviz", "Richie Hawtin", "Carl Cox", "Jeff Mills", "Derrick May", "Juan Atkins", "Skrillex", "Deadmau5", "Kaskade",
    "Calvin Harris", "Avicii", "Swedish House Mafia", "Justice", "Gesaffelstein", "Kraftwerk", "Jean Michel Jarre", "Giorgio Moroder", "Vangelis", "Rone",
    "Mace", "Cosmo", "Crookers", "Benny Benassi", "Meduza", "Anyma", "Tale Of Us", "Mind Against", "Stefano Noferini", "Reinier Zonneveld",
  ],
  Altro: [
    "Miles Davis", "John Coltrane", "Herbie Hancock", "Chet Baker", "Bill Evans", "Thelonious Monk", "Art Blakey", "Esperanza Spalding", "Kamasi Washington", "Nubya Garcia",
    "Duke Ellington", "Charles Mingus", "Sonny Rollins", "Wayne Shorter", "Pat Metheny", "Chick Corea", "Keith Jarrett", "Brad Mehldau", "Diana Krall", "Norah Jones",
    "B B King", "Muddy Waters", "John Lee Hooker", "Buddy Guy", "Joe Bonamassa", "Stevie Ray Vaughan", "Etta James", "Howlin Wolf", "Robert Johnson", "Keb Mo",
    "Bob Marley", "Peter Tosh", "Burning Spear", "Gregory Isaacs", "Toots and the Maytals", "Jimmy Cliff", "Steel Pulse", "UB40", "Damian Marley", "Ziggy Marley",
    "Aretha Franklin", "Marvin Gaye", "Al Green", "Otis Redding", "Sam Cooke", "Stevie Wonder", "Curtis Mayfield", "James Brown", "Parliament", "Funkadelic",
  ],
};

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

function buildRows() {
  const rows = [];
  const seen = new Set();

  for (const [genre, artists] of Object.entries(categoryArtists)) {
    for (const artist of artists) {
      const key = artist.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ artist, artistLower: key, genre });
    }
  }

  return rows;
}

function buildSql() {
  const rows = buildRows();
  const values = rows
    .map(
      (r) =>
        `('${escapeSql(r.artist)}', '${escapeSql(r.artistLower)}', '${escapeSql(r.genre)}', true)`
    )
    .join(",\n");

  return `-- Auto-generated watched artists bootstrap
-- Generated at ${new Date().toISOString()}

BEGIN;

CREATE TABLE IF NOT EXISTS watched_artists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_name TEXT NOT NULL,
  artist_name_lower TEXT NOT NULL UNIQUE,
  genre TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  last_check TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS album_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID REFERENCES watched_artists(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  album_title TEXT NOT NULL,
  release_date TEXT,
  source TEXT NOT NULL,
  retailer_url TEXT,
  cover_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'purchased', 'dismissed')),
  edition_details TEXT,
  price_eur NUMERIC(10, 2),
  discovered_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ
);

ALTER TABLE watched_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watched_artists' AND policyname = 'Allow all watched_artists'
  ) THEN
    CREATE POLICY "Allow all watched_artists" ON watched_artists FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'album_alerts' AND policyname = 'Allow all album_alerts'
  ) THEN
    CREATE POLICY "Allow all album_alerts" ON album_alerts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_watched_artists_active ON watched_artists(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_album_alerts_status ON album_alerts(status);
CREATE INDEX IF NOT EXISTS idx_album_alerts_artist_id ON album_alerts(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_alerts_created ON album_alerts(discovered_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_album_alerts_dedup_norm ON album_alerts (
  lower(trim(artist_name)),
  lower(trim(regexp_replace(album_title, '\\s+', ' ', 'g'))),
  source
);

INSERT INTO watched_artists (artist_name, artist_name_lower, genre, is_active) VALUES
${values}
ON CONFLICT (artist_name_lower) DO UPDATE SET
  genre = EXCLUDED.genre,
  is_active = true;

COMMIT;
`;
}

const sql = buildSql();
const outputDir = path.join(process.cwd(), "scripts", "output");
const outputPath = path.join(outputDir, "bootstrap-watched-artists.sql");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, sql, "utf8");

const counts = Object.fromEntries(
  Object.entries(categoryArtists).map(([k, v]) => [k, v.length])
);

console.log("Generated SQL file:", outputPath);
console.log("Requested artists per category:", counts);
console.log("Total requested rows:", Object.values(counts).reduce((a, b) => a + b, 0));
