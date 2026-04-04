const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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
    "Nerissima Serpe",
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

function flattenCategoryArtists(input) {
  const rows = [];
  for (const [genre, artists] of Object.entries(input)) {
    for (const artist of artists) {
      rows.push({
        artist_name: artist,
        artist_name_lower: artist.toLowerCase().trim(),
        genre,
        is_active: true,
      });
    }
  }
  return rows;
}

async function seedWatchedArtists() {
  const rows = flattenCategoryArtists(categoryArtists);
  const perCategoryCounts = Object.fromEntries(
    Object.entries(categoryArtists).map(([k, v]) => [k, v.length])
  );

  console.log("Starting watched_artists seed");
  console.log("Requested per category:", perCategoryCounts);
  console.log("Total rows requested:", rows.length);

  const seen = new Set();
  const dedupedRows = [];
  for (const row of rows) {
    if (seen.has(row.artist_name_lower)) continue;
    seen.add(row.artist_name_lower);
    dedupedRows.push(row);
  }

  const duplicateCount = rows.length - dedupedRows.length;
  if (duplicateCount > 0) {
    console.log(`Removed duplicate artist names across categories: ${duplicateCount}`);
  }

  const { data, error } = await supabase
    .from("watched_artists")
    .upsert(dedupedRows, { onConflict: "artist_name_lower", ignoreDuplicates: false })
    .select("id");

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  const { data: stats, error: statsError } = await supabase
    .from("watched_artists")
    .select("genre", { count: "exact" })
    .eq("is_active", true);

  if (statsError) {
    console.error("Seed completed but stats query failed:", statsError.message);
    process.exit(1);
  }

  const countByGenre = {};
  for (const row of stats || []) {
    const genre = row.genre || "Unknown";
    countByGenre[genre] = (countByGenre[genre] || 0) + 1;
  }

  console.log("Seed completed");
  console.log("Upserted rows:", data?.length || 0);
  console.log("Current active watched artists by genre:", countByGenre);

  const minRequired = 50;
  const belowTarget = Object.entries(countByGenre).filter(([, count]) => count < minRequired);
  if (belowTarget.length > 0) {
    console.warn("Genres below target 50:", belowTarget);
  } else {
    console.log("All seeded genres are at or above 50 artists");
  }
}

seedWatchedArtists()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
