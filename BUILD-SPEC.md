# PowerChapter Member Portal — Production Build Specification

**Version:** 0.1 (from the clickable prototype, September 2026)
**Audience:** the developer (or Claude session) building the production powerchapter.com
**Prototype:** https://chapters.fourcornerholdings.com (noindex, sample data). Source is in this folder.

This document turns the prototype into buildable requirements. Where the prototype fakes something (email, IP lookup, roster upload, provider handoff), this spec says what production must do instead. Items marked **OPEN** need a decision before build.

---

## 1. Product summary

PowerChapter is a national network of acknowledged Chambers of Commerce. Each chamber is a **chapter**. Members of a chapter sign in and use benefits listed in **The Book**. The site behaves like a retail "choose your store" experience: it suggests the nearest chapter from approximate location, the visitor can change it, and membership verification (not location) decides who can use benefits.

Reference patterns:
- **AARP / AAA**: national membership, local chapter or club layer
- **Walmart.com store picker**: persistent location pill, a drawer to change it, nearest-first list
- **Executive Partner territory map**: county choropleth with state drill-down (reused here)

## 2. Site map

| Route | Audience | Purpose |
|---|---|---|
| `/` | Public | Hero with chapter search, member-card preview, nearest-chapter strip, how it works, The Book preview, network stats, chamber CTA |
| `/chapters` | Public | Chapter finder: search, state filter, county map, chapter/state detail panel |
| `/chapters/{state}/{slug}` | Public | Chapter page: photos, about, service-area market table and map, leadership, benefits, events, announcements |
| `/book` | Public | Benefits catalog with category filter |
| `/book/{benefit}` | Public (CTA gated) | Benefit detail. The request button needs a verified member of a chapter where the benefit is live |
| `/standard` | Public | Acknowledgement Standard |
| `/for-chambers` | Public | Application steps, link to the application |
| `/activate` | Public | Membership activation: chapter → verification → details and consent → magic link |
| `/member` | Member | Dashboard: membership chapter, benefits, events, announcements, stored-data view |
| `/admin` | Chamber admin | Verification queue, invite codes, roster import, benefit toggles, announcements, totals-only KPIs |
| `/ops` | PowerChapter staff | Chapters, providers, acknowledgement status, content (not in prototype) |
| `/privacy`, `/terms` | Public | Legal. Privacy must describe the IP and location handling in §5 |

The prototype uses hash routes (`#/chapter/tampa-bay`). Production uses real paths with server rendering so chapter pages can be indexed when launched.

## 3. Data model

### 3.1 Chapter
| Field | Type | Rules |
|---|---|---|
| id | uuid | |
| slug | string | Unique per state, URL-safe |
| legal_name, display_name | string | display_name is shown everywhere |
| city, state | string | state = USPS code |
| lat, lng | decimal(9,6) | Chamber office or city center. Used for distance |
| service_counties | string[] | 5-digit county FIPS. At least 1. Drives the market table and map outline |
| status | enum | `applied`, `under_review`, `acknowledged_onboarding`, `acknowledged_live`, `suspended`, `withdrawn` |
| acknowledged_at | date | Set when status first becomes acknowledged |
| profile | json | founded_year, member_count, description, website, phone, address, social |
| media | json | hero, logo, leaders[] (image, name, title) |
| invite_code | string | Current code (hashed at rest). Rotation invalidates the old code |
| created_at, updated_at, updated_by | audit | |

Only `acknowledged_onboarding` and `acknowledged_live` chapters appear publicly. Benefits are usable only at `acknowledged_live`.

### 3.2 Member
| Field | Rules |
|---|---|
| id, member_number | member_number shown on the member card, e.g. `PC-1234 5678` |
| name, email, business_name | The **only** personal data PowerChapter stores |
| home_chapter_id | Membership chapter |
| verification_status | `pending`, `verified`, `rejected`, `revoked` |
| verification_method | `invite_code`, `roster_match`, `admin_approval` |
| consent_version, consent_at | Required before the account is created |
| browse_chapter_id | Optional. Personalizes content only |
| last_login_at | |

Never stored: financial data, credit data, SSN/EIN, location history, IP address beyond short-lived security logs.

### 3.3 Benefit and ChapterBenefit
- **Benefit:** id, provider_name, title, short_title, category, listed_value (text, as published), description, detail_page (bool), intake_url_template, status (`draft`, `listed`, `retired`).
- **ChapterBenefit:** chapter_id, benefit_id, enabled (bool), enabled_at, enabled_by.

### 3.4 Handoff (benefit request)
id, member_id, benefit_id, chapter_id, reference (one-time, e.g. `PC-DAL-7K2Q9M`), created_at. **No payload beyond these references is sent to the provider.**

### 3.5 County market data
Static table keyed by FIPS: county_name, state, establishments, employees, source (`BLS QCEW`), year. The prototype ships `territory-data.js` (QCEW 2024 annual averages, 3,140 counties, AlbersUSA-projected TopoJSON). Refresh yearly when BLS publishes.

## 4. Chapter resolution (core rule)

Resolve the chapter shown in the header pill in this order. Stop at the first hit.

1. **Verified membership:** the member's `home_chapter_id` where status = verified.
2. **Saved choice:** `browse_chapter_id` (account) or a first-party cookie (anonymous).
3. **Device location:** only after the visitor clicks "Use my current location" and the browser grants permission.
4. **Approximate location (IP):** read from the host's edge geolocation headers (Netlify `context.geo`, Vercel `x-vercel-ip-latitude` and `x-vercel-ip-longitude`, Cloudflare `request.cf`). No third-party IP API. Don't persist the IP.
5. **Search:** ZIP, city, county, state, or chamber name.

**Business rules**
- **R1:** Location never grants eligibility. Only verification does.
- **R2:** If the nearest chapter is farther than `NEAR_RADIUS_MILES` (default 150, configurable), show "No chapter near you" with the nearest listed and a "Ask your chamber to join" CTA. Don't auto-assign.
- **R3:** An IP-based suggestion is labeled "Suggested chapter" and shows a "Yes, this is my chapter" confirm button. Confirming converts it to a saved choice.
- **R4:** A verified member who browses another chapter sees that chapter's news and events. Benefits always follow the membership chapter. The pill reads "Browsing chapter" in that case.
- **R5:** Distance is great-circle miles from the visitor point to the chapter's lat/lng. Ties are broken alphabetically.

## 5. Chapter finder

- **Inputs:** a search box with typeahead, a state select, a Businesses/Employees toggle, "Near me", and "United States" reset.
- **Typeahead groups and order:** Chapter, ZIP (exact 5 digits), State, County (prefix match, max 4), City (prefix match, max 4). Max 9 suggestions. Enter picks the highlighted or first suggestion.
- **Map:** county choropleth (7-step quantile ramp at q = .35/.60/.80/.90/.96/.99), state borders, gold outline of each chapter's merged service area, pins (filled = live, hollow = onboarding), and a "you" marker. Clicking a county focuses its state. If the county is served, it selects that chapter. Zoom animates to the state.
- **Side panel states:**
  - **Network:** all chapters, or the nearest five when a location is known.
  - **State:** statewide totals, chapters in the state (or the no-chapter message), and the top five business counties with served / no-chapter flags.
  - **Chapter:** profile, service-area totals (businesses, employees, share of state, counties), a per-county list, "Make this my chapter", "Chapter page", and a back-to-state link.
- **Source line (required):** "Business counts are annual-average employer establishments from the U.S. Bureau of Labor Statistics (QCEW, {year})."

## 6. Activation and verification

**Steps:** chapter → verification method → name, email, business and consent → magic-link email → dashboard.

| Method | Result | Notes |
|---|---|---|
| Invite code matches the chapter's current code | `verified` | Rate-limit to 5 attempts per 15 minutes per IP and email |
| Roster match (email on the uploaded roster) | `verified` | Case-insensitive exact email match |
| Request confirmation | `pending` | Appears in the chamber's verification queue |

**Reason codes**

| Code | Meaning |
|---|---|
| `VER_OK_CODE` | Verified by invite code |
| `VER_OK_ROSTER` | Verified by roster match |
| `VER_OK_ADMIN` | Approved by a chamber admin |
| `VER_PENDING` | Waiting on the chamber |
| `VER_FAIL_CODE` | Invite code did not match |
| `VER_FAIL_RATE` | Too many attempts |
| `VER_REJECT_ADMIN` | Rejected by a chamber admin |
| `VER_REVOKED` | Removed from the roster, or revoked by an admin |
| `CH_NOT_LIVE` | The chapter is still onboarding |
| `BEN_DISABLED` | The chamber turned the benefit off |

- **Auth:** passwordless email magic link (15-minute expiry, single use). Optional passkeys later.
- **Email changes** require re-verification of the new address.

## 7. Benefit handoff

- **Gate:** member verified AND chapter `acknowledged_live` AND ChapterBenefit enabled. Otherwise show the matching reason (§6).
- **Flow:** an interstitial ("You are leaving PowerChapter") lists exactly what is passed: the chapter reference and a one-time reference. It then opens `intake_url_template` in a new tab with `?pc_chapter={slug}&pc_ref={reference}`.
- **PII rule:** never put name, email, or business name in the URL. If a provider needs to match a member, it asks the member directly.
- **Record:** log the Handoff row. The member's dashboard shows "Requested {date}".

## 8. Roles and permissions

| Capability | Visitor | Member | Chamber admin | Chamber viewer | PC ops |
|---|---|---|---|---|---|
| Finder, chapter pages, The Book | ✓ | ✓ | ✓ | ✓ | ✓ |
| Request a benefit | — | verified only | — | — | — |
| Verification queue approve/reject | — | — | own chapter | view | all |
| Rotate invite code, import roster | — | — | own chapter | — | all |
| Toggle benefits | — | — | own chapter | — | all |
| Post announcements, edit profile and media | — | — | own chapter | — | all |
| Totals-only KPIs | — | — | own chapter | own chapter | all |
| Chapter status, providers, The Book | — | — | — | — | ✓ |

Chamber staff **never** see members' benefit submissions, credit or financial data, or provider results. KPIs are counts: invited, activated, activation rate, and handoffs by benefit.

## 9. Audit

Log with actor, role, timestamp, before and after values: chapter status changes, invite-code rotation (never log the code), roster imports (row counts only), verification decisions and reason codes, benefit toggles, profile and media edits, announcement posts and deletes, consent capture (version and timestamp), and admin role grants. Retain for 7 years. Admins can export their own chapter's log.

## 10. Privacy and compliance requirements

- **Public wording:** PowerChapter's current public copy says "zero data collection" and "no login." With accounts and location suggestions, that copy must be revised before launch. **OPEN:** approved wording, reviewed by counsel.
- **Privacy notice:** state that approximate location comes from the connection, that device location is used only on request, and list exactly what is stored (§3.2). The prototype's `/privacy` page is the starting draft.
- **Benefit copy:** keep it consistent with the "free, no upsell" standard. Readiness-assessment pages must carry the provider's disclaimers verbatim: not an approval or credit decision, self-reported scores are not verified reports, and no credit-report retrieval in the free assessment.
- **Accessibility:** WCAG 2.1 AA. The map must have a full keyboard and list alternative (the side panel already provides one).
- **Indexing:** keep the site noindex until real chapters and approved copy are live.

## 11. Suggested stack

- **App:** Next.js (App Router) with TypeScript, server-rendered chapter pages.
- **Database:** Postgres (Supabase or Neon) with PostGIS. Nearest chapter: `ORDER BY location <-> ST_MakePoint(lng, lat)::geography LIMIT 5`.
- **Auth:** Supabase Auth or Auth.js email magic links.
- **Maps:** d3 + topojson (as in the prototype) for the choropleth. No map-tile vendor is needed.
- **ZIP geocoding:** a static ZIP-centroid table (the prototype's `zips.js` has 42k ZIPs), or the Census geocoder at import time.
- **Hosting:** Netlify or Vercel, using their edge geo headers for §4 step 4.
- **Email:** transactional provider for magic links (Postmark, Resend, or Brevo).
- **Media:** object storage with image resizing. Photo slots are already in every template.

## 12. Acceptance criteria

1. A new visitor from a known metro sees "Suggested chapter: {nearest}" in the pill within one page load. Confirming it saves it.
2. A visitor more than 150 miles from any chapter sees "No chapter yet" and the join CTA. No chapter is auto-assigned.
3. Searching `33618` selects the nearest chapter and zooms the map to its state. Searching `83702` shows the Idaho state panel with no chapter.
4. Searching a county name shows that county's state. If the county is served, its chapter is selected.
5. The chapter panel's business total equals the sum of its service counties in the QCEW table.
6. An unverified member cannot start a handoff and sees the `VER_PENDING` message.
7. The handoff URL contains only `pc_chapter` and `pc_ref`.
8. Rotating an invite code makes the old code fail with `VER_FAIL_CODE`.
9. Turning a benefit off hides it from that chapter's members within one page load.
10. Chamber admins cannot reach another chapter's admin data by URL or API. Test returns 403.
11. No horizontal scroll at 390px. All interactive elements are keyboard reachable with a visible focus ring.
12. Lighthouse accessibility ≥ 95 on home, finder, chapter, and benefit pages.

## 13. Edge cases

- **VPN or mobile-carrier IP:** the suggestion may be wrong. The confirm step and "Change" link handle it.
- **Chapters that cross state lines:** multi-state `service_counties` are allowed. Share of state is computed per state involved.
- **Two chapters claiming the same county:** block on save and require PC ops to resolve.
- **Member moves to another chapter:** create a transfer request. The new chapter verifies, and the old membership is closed.
- **Chapter suspended:** members keep accounts. Benefits are hidden and the dashboard explains why.
- **Duplicate email across chapters:** one account per email, one membership chapter.
- **ZIPs without a centroid** (PO boxes, military): fall back to city search with a message.
- **Hawaii, Alaska, and territories:** AlbersUSA covers AK and HI. Territories need a list-only fallback.

## 14. QA test list

| Area | Tests |
|---|---|
| Chapter resolution | IP suggestion, confirm, change, geo permission denied, beyond radius, member browsing another chapter |
| Search | ZIP hit and miss, county prefix, city, state, chamber name, keyboard navigation, XSS in the query string |
| Map | County click, pin click and keyboard, state zoom and reset, metric toggle, tooltip content matches data |
| Activation | Valid, wrong, and rotated code; request path; consent unchecked; bad email; magic link expired or reused |
| Handoff | Each gate failure, success interstitial, URL parameters, dashboard state |
| Admin | Approve and reject, roster import counts, benefit toggle, announcement visibility, cross-chapter access denied |
| Privacy | No IP persisted, no PII in URLs or analytics events, stored-data view matches the database |
| Responsive / a11y | 390, 768, 1280 widths; screen-reader labels on map, pins, toggles |

## 15. Not implementation-ready (decide before build)

1. **OPEN:** Final chapter list, each chapter's service counties, and who at each chamber is the admin.
2. **OPEN:** Revised public wording on data collection and login (§10).
3. **OPEN:** Provider intake URLs and whether providers accept `pc_chapter` and `pc_ref`.
4. **OPEN:** Whether rosters are uploaded by chambers, or members verify by invite code only.
5. **OPEN:** Member transfer and renewal rules when chamber membership lapses.
6. **OPEN:** Brand: the prototype's wordmark, shield and palette are placeholders.
7. **OPEN:** Analytics tool and consent banner requirements by state.

## 16. Prototype file map

| File | What it is |
|---|---|
| `index.html` | Shell: ribbon, chapter pill, header, footer, drawer, demo controls |
| `assets/app.css` | Design tokens (light and dark) and components |
| `assets/app.js` | Router, chapter resolution, finder map, pages, activation, admin |
| `assets/data/chapters.js` | **Edit this** to add chapters, counties, benefits and sample content |
| `assets/data/territory-data.js` | County TopoJSON plus QCEW 2024 counts (`data[fips] = [name, state, establishments, employees]`) |
| `assets/data/zips.js` | ZIP → lat/lng/city lookup (42,249 ZIPs) |
| `assets/photos/` | Drop images here using the names in the placeholders (e.g. `tampa-bay-hero.jpg`, `benefit-zenhur.jpg`) |
