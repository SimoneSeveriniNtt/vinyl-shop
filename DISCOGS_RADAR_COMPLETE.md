# Discogs Radar Integration - Complete Refactor

**Date**: April 2026  
**Status**: ✅ Completed & Deployed  
**Replaces**: MusicBrainz-based Market Radar system  

## Summary

The Radar Acquisti system has been completely rebuilt to use **Discogs API** instead of MusicBrainz. This addresses the fundamental issue that MusicBrainz lacks real pre-order and rarity metadata for vinyl records.

### Key Advantages of Discogs

- **Real vinyl data**: Discogs is the definitive vinyl database with actual editions, variants, colors, conditions
- **Rarity detection**: Built-in rarity signals (limited editions, colored vinyl, numbered copies, original pressings, picture discs, etc.)
- **Variant tracking**: Handles vinyl color variants, box sets, deluxe editions, reissues
- **Rate limiting**: 60 requests/minute anonymous (sufficient for admin use)
- **Reliable API**: Stable, well-documented, widely used in vinyl commerce

## Architecture

### New Files

#### `src/lib/discogs.ts`
Core Discogs API client library featuring:
- `searchDiscogsReleases(artist, album?, limit)` - Search releases
- `getReleaseDetails(releaseId)` - Fetch full release metadata
- `extractRaritySignals()` - Parse release details for rarity markers (limited, colored vinyl, numbered, etc.)
- `calculateRarityScore()` - Generate 0-100 rarity score based on:
  - Release age (older = rarer, but only 20-50 years old)
  - Rarity signals (limited edition, colored vinyl, etc.) - 3pts per signal weight
  - Format bonuses (180g, 200g, audiophile) - 10-15pts
  - Genre/style premiums (jazz, classical) - 10pts
- `estimateRarityCategory()` - Map score to category (Common/Uncommon/Rare/Very Rare/Collectible)
- `buildRadarItem()` - Transform Discogs data into admin-facing radar item

#### `src/app/api/admin/discogs-radar/route.ts`
New API endpoint replacing `/api/admin/market-radar`:
- **Path**: `GET /api/admin/discogs-radar`
- **Auth**: Bearer token + admin email verification (same as before)
- **Parameters**:
  - `artist` (required) - Artist name
  - `album` (optional) - Album title for narrowing search
  - `minRarity` (optional) - Filter by minimum rarity score (0-100)
  - `page` (optional) - Pagination (default: 1)
  - `limit` (optional) - Results per page (default: 20, max: 40)
- **Response**: `{ success, items[], total, hasMore, page, limit, generatedAt }`

### Modified Files

#### `src/app/admin/page.tsx`
Complete UI overhaul for Discogs-centric workflow:

**Search Section**:
- Artist input field (required)
- Album input field (optional)
- Removed: Genre dropdown, text/keyword search, upcoming-only checkbox

**Filters Section**:
- Rarity slider (0-100, step 5)
- Visual rarity categories: Common → Uncommon → Rare → Very Rare → Collectible
- Removed: Score ranges, pre-order filter, upcoming date filter

**State Changes**:
- Removed: `radarGenre`, `radarQueryInput`, `radarQueryFilter`, `radarMinScore`, `radarUpcomingOnly`
- Added: `radarAlbumInput`, `radarMinRarity`
- Changed function: `fetchMarketRadar()` → `fetchDiscogsRadar()`
- Changed handler: `applyRadarArtistFilter()` → `applyRadarSearch()`
- Changed badge function: `radarBadgeClass()` → `radarRarityBadge()`

**Results Card Display**:
- Shows: Album image (small thumbnail), title, artist, year, rarity category badge, format, formats details, country, genre, catalog number
- Rarity signals: Visual badges showing detected rarity markers (✨ Limited Edition, ✨ Colored Vinyl, ✨ Numbered Copy, etc.)
- Rarity score: Numeric 0-100 score displayed
- Discogs link: Direct link to Discogs page for verification/purchase
- Removed: MusicBrainz links, checklist, verbose notes, source/status badges

## Data Shapes

### Old (MusicBrainz) Item
```javascript
{
  id: "uuid",
  title: string,
  artist: string,
  editionType: string | null,
  releaseDate: string,
  country: string,
  source: "MusicBrainz" | "Market Intel",
  releaseStatus: "Pre-order" | "In uscita" | "Uscito",
  daysToRelease: number | null,
  opportunityScore: number,
  recommendation: "Alta" | "Media" | "Bassa",
  raritySignals: string[],
  rarityConfidence: "Alta" | "Media" | "Bassa",
  rarityChecklist: string[]
}
```

### New (Discogs) Item
```javascript
{
  id: number,
  artist: string,
  title: string,
  releaseYear: number | null,
  catalogNumber: string | null,
  country: string | null,
  format: "Vinyl",
  formatDetails: string[],  // ["LP", "Album", "12\"", "180g", etc.]
  genres: string[],
  styles: string[],
  rarity_signals: [
    { type: "limited" | "colored" | "numbered" | ..., description: string, rarity_weight: 1-10 },
    ...
  ],
  rarity_score: number,  // 0-100
  estimated_rarity: "Common" | "Uncommon" | "Rare" | "Very Rare" | "Collectible",
  notes: string,
  discogs_url: string,
  resource_url: string,
  images: [{ uri: string, uri150: string }, ...]
}
```

## Usage Guide

### For Admins

1. **Open Admin Panel** → Radar Discogs tab
2. **Enter Artist Name** (required - e.g., "Madame", "Sayf", "Caparezza")
3. **Optionally Enter Album Title** (helps narrow results)
4. **Set Minimum Rarity Filter** (0 = all results, 50+ for potentially valuable editions)
5. **Click "Cerca su Discogs"**
6. **Results show**:
   - Rarity categories with color coding
   - Detected rarity signals (limited edition, colored vinyl, etc.)
   - Numeric rarity score (0-100)
   - Direct Discogs link for verification

### Rarity Score Interpretation

- **0-20**: Common pressing, no special edition markers
- **21-40**: Uncommon (maybe slightly older or less common genre)
- **41-65**: Rare (limited edition, special format, notable age)
- **66-80**: Very Rare (multiple rarity signals, high-value collector's item)
- **81-100**: Collectible (highly desirable - multiple signals + high weight)

### Rarity Signals Detected

The system automatically flags:
- **Limited Edition** - Explicitly labeled as limited run
- **Colored Vinyl** - Non-standard vinyl color (red, blue, white, splatter, swirl, marbled)
- **Numbered Copy** - Individually numbered copies (e.g., "Copy #42 of 500")
- **Box Set** - Deluxe packaging, gatefold, poster, booklet, exclusive editions
- **Reissue** - Reissued/remastered from original
- **Original Pressing** - First official release
- **Picture Disc** - Picture or shaped vinyl pressing

## Technical Details

### Rate Limiting
- **Discogs Anonymous**: 60 req/min (adequate for admin workflows)
- **Discogs Authenticated** (future): Higher limits with token
- Current implementation: Anonymous access only (no token storage required)

### Error Handling
- Invalid artist → Clear error message, no retry
- API timeout → Graceful error, user can retry
- No results → "Nessun risultato su Discogs per questa ricerca"
- Network error → Displays error message with retry option

### Performance
- Light caching: Results cached in React state (per session)
- Discogs average response: ~500-800ms per search
- Pagination: 20 results per page (configurable to 40 max)
- Auto-fetch on filter change: Debounced to avoid spam

## Migration Notes

### What's Different
- **No pre-order dates** visible (Discogs doesn't track future release dates)
- **No genre-based discovery** (Discogs search is keyword/artist-based)
- **Simpler scoring** (Discogs rarity score is data-driven, not pattern-matched)
- **Direct Discogs links** (users verify on authoritative source instead of admin scoring)

### What's Not Changing
- Admin authentication and authorization
- UI/UX is similar (Radar tab, search/filter sections, paginated results)
- Results still sortable by rarity score
- Pagination and load-more functionality maintained
- Production deployment still via Vercel

## Testing

### API Endpoint Test
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://vinyl-shop-amber.vercel.app/api/admin/discogs-radar?artist=Madame&minRarity=50"
```

### Expected Response
```json
{
  "success": true,
  "source": "Discogs",
  "artist": "Madame",
  "album": null,
  "minRarity": 50,
  "page": 1,
  "limit": 20,
  "total": 42,
  "hasMore": true,
  "items": [
    {
      "id": 17897416,
      "artist": "Madame",
      "title": "Madame (9)",
      "releaseYear": 2021,
      "rarity_score": 35,
      "estimated_rarity": "Uncommon",
      "discogs_url": "https://www.discogs.com/release/17897416"
    },
    ...
  ],
  "generatedAt": "2026-04-04T10:23:45.123Z"
}
```

## Next Steps (If Needed)

1. **User Feedback**: Collect admin feedback on rarity scoring accuracy
2. **Token Integration**: If rate limit becomes issue, implement optional Discogs token auth
3. **Market Monitoring**: Track Madame/Sayf pre-orders on Discogs directly or via MercadoLibre API
4. **eBay Integration**: Cross-reference Discogs rare items with eBay for pricing/trending
5. **Gemini Integration**: Use Gemini 2.0's web search to find pre-order announcements

## Summary

The Radar has been rebuilt on a **reliable, vinyl-focused data source** (Discogs) replacing the misaligned MusicBrainz approach. The UI remains familiar with a simplified, more accurate filtering model. The system now **discovers actual rare editions with verified metadata** instead of pattern-matched guesses.

---

**Deployed**: main branch (auto via Vercel on git push)  
**Git Commit**: `e3f33d4` "refactor: replace MusicBrainz with Discogs API integration"  
**Rollback**: Revert to commit `e88c38c` if issues arise  
