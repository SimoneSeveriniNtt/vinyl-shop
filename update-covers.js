const token = "sbp_61739d7eb938478a68e109c2baca123b40cf418a";
const ref = "hlbxaagjaryjhkblldqk";
const dbUrl = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function q(sql) {
  const r = await fetch(dbUrl, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return await r.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function searchMusicBrainz(artist, album) {
  const query = encodeURIComponent(`artist:"${artist}" AND release:"${album}"`);
  const mbUrl = `https://musicbrainz.org/ws/2/release/?query=${query}&fmt=json&limit=5`;
  console.log(`  MB URL: ${mbUrl}`);
  try {
    const r = await fetch(mbUrl, {
      headers: { "User-Agent": "VinylShopCoverUpdater/1.0 (contact@example.com)" }
    });
    console.log(`  MB status: ${r.status}`);
    if (!r.ok) {
      const text = await r.text();
      console.log(`  MB error body: ${text.substring(0, 200)}`);
      return null;
    }
    const data = await r.json();
    console.log(`  MB releases found: ${data.releases ? data.releases.length : 0}`);
    if (data.releases && data.releases.length > 0) {
      const ids = data.releases.map(rel => rel.id);
      console.log(`  MB IDs: ${ids.join(', ')}`);
      return ids;
    }
  } catch (e) {
    console.error(`  MusicBrainz search failed for ${artist} - ${album}:`, e.message);
  }
  return null;
}

async function verifyCoverUrl(mbid) {
  const coverUrl = `https://coverartarchive.org/release/${mbid}/front-500`;
  console.log(`  Checking cover: ${coverUrl}`);
  try {
    const r = await fetch(coverUrl, { redirect: "manual" });
    console.log(`  Cover status: ${r.status}`);
    if (r.ok || (r.status >= 300 && r.status < 400)) {
      return coverUrl;
    }
  } catch (e) {
    console.log(`  Cover fetch error: ${e.message}`);
  }
  return null;
}

async function findCover(artist, album) {
  const mbids = await searchMusicBrainz(artist, album);
  if (!mbids) return null;
  
  for (const mbid of mbids) {
    const coverUrl = await verifyCoverUrl(mbid);
    if (coverUrl) {
      return coverUrl;
    }
    await sleep(300);
  }
  return null;
}

const vinyls = [
  { id: "c2db8d74-042f-4f27-9e0d-9fb9fd5e4e44", artist: "Salmo", title: "Flop" },
  { id: "cd105529-6f13-42c2-8a8c-61a02908e877", artist: "Salmo", title: "Playlist" },
  { id: "0d0247f0-7211-4657-ac4f-3b3b44b04bb8", artist: "Blanco", title: "Blu Celeste" },
  { id: "6bcca16c-10ed-4490-9c36-0c9afee6d01f", artist: "Madame", title: "L'Anima" },
  { id: "b0694a7c-4521-4064-89ad-8cef5f70bff6", artist: "Madame", title: "Madame" },
  { id: "573398a7-a2ab-4ad7-be01-2bff4ea56cd3", artist: "Marracash", title: "Noi, Loro, Gli Altri" },
  { id: "92d1b0e2-0cb6-41fe-810f-17a99c466575", artist: "Lazza", title: "Sirio" },
  { id: "3b3c8272-1e29-43cf-bedd-9e5851ca7044", artist: "Lazza", title: "Locura" },
  { id: "8d931764-889c-484f-91dc-6ed873cbf65f", artist: "Mahmood", title: "Ghettolimpo" },
  { id: "1b9bd02d-35a6-4470-9817-96788f6f5556", artist: "Sfera Ebbasta", title: "X2VR" },
  { id: "52f0bfc7-6946-4a04-829b-93f3205f66df", artist: "Anna", title: "Vera Baddie" },
  { id: "307fce01-c410-4b93-88a2-e7186c692c4d", artist: "Rkomi", title: "Taxi Driver" },
  { id: "7d8145b8-3982-4d81-98d1-26305df10096", artist: "Daft Punk", title: "Random Access Memories" },
  { id: "6f48964b-4d07-4fe3-8087-108c13658065", artist: "Dua Lipa", title: "Future Nostalgia" },
  { id: "c4e64652-1b4a-4eab-977f-89450ceb8bc9", artist: "Rüfüs Du Sol", title: "Surrender" },
];

async function main() {
  // Test with just one album first
  console.log("Testing with Daft Punk - Random Access Memories");
  const mbids = await searchMusicBrainz("Daft Punk", "Random Access Memories");
  if (mbids) {
    for (const mbid of mbids.slice(0, 3)) {
      const cover = await verifyCoverUrl(mbid);
      if (cover) {
        console.log(`  WORKING COVER: ${cover}`);
        break;
      }
      await sleep(500);
    }
  }
}

main();
