# How Snehal wants Claude to work (feedback from earlier sessions)

## feedback-japan-placename-descriptions

In anything written for the Japan trip (chat answers, itinerary notes, site text), follow every place name with a short description in parentheses saying what it is and what the user sees or does there, e.g. "Ohara (farm valley north of Kyoto: Sanzen-in's moss garden and stone statues, matcha facing a framed garden)". Applies to temples, shops, stations used as landmarks, restaurants, viewpoints, experiences.

**Why:** The user, Snehal, cannot keep dozens of Japanese names straight and asked on 2026-11-11 to be told what will be lost or gained in terms of the actual experience, not just the name. See user-snehal-profile.md and project-japan-trip-nov-2026.md.

**How to apply:** Only for the Japan trip work, not other projects. This overrides any general style habit of avoiding parentheses. Keep each description to one line; repeat it the first time a place appears in each answer.

## feedback-check-reddit-for-products

Before recommending any product or service, check what Reddit (e.g. r/JapanTravelTips, niche subs) says, and weight that over "best X 2026" comparison blogs.

**Why:** On 2026-11-15 I recommended Holafly for the Japan eSIM from vendor/affiliate pages; Snehal pointed out Reddit consistently favours Ubigi (docomo/KDDI, broad coverage) and Holafly has a poor reputation there (throttling, refunds). They called it "falling for LLM SEO".

**How to apply:** Search with "reddit" in the query (or site-specific subreddit terms), note where community consensus differs from blogs, and say which the pick is based on. Treat vendor-authored comparison pages as biased. Related: user-snehal-profile.md

## feedback-inline-photos-in-replies

When presenting places or options to Snehal, embed the photos inline in the reply itself.

**Why:** On Nov 12 2026 I sent a photo comparison sheet as a file (SendUserFile) alongside a text answer about emerald-water options. The next message said "ember photos too in your reply" (embed photos in the reply). My reading: the file card was not enough, they want pictures next to the words. Fits the standing preference for visuals in user-snehal-profile.md.

**How to apply:** Use the visualize `show_widget` tool with a photo card grid. Its sandbox only loads images from a few CDNs, so put the photos in the trip repo (`/Users/ssha/japan-trip-site/img/opt/`, pushed to snehal-sha/japan-trip-site) and reference them as `https://cdn.jsdelivr.net/gh/snehal-sha/japan-trip-site@<commit>/img/opt/<name>.jpg`. Use the full 40-character commit hash: on Nov 13 2026 a short-hash URL returned 403 ("Package size exceeded the configured limit of 50 MB") for a new file while the full-hash URL returned 200; check each URL with curl before showing the widget. Existing place photos under `img/pl/` work the same way. Keep the text short and put one line per option. See project-japan-trip-nov-2026.md.

## feedback-push-site-to-github

Snehal hosts the trip site publicly at https://snehal-sha.github.io/japan-trip-site/ (repo snehal-sha/japan-trip-site, `gh` is logged in as snehal-sha). After every change to the site, push the latest build there too, not only to the claude.ai artifact.

**Why:** The friend-facing link is the GitHub one; on Oct 20 2026 it went stale after an artifact-only update and Snehal noticed the new options were missing.

**How to apply:** After `build.py`, clone or reuse the repo checkout, copy `japan-trip/preview.html` to `index.html` plus the `img/` folder and `.nojekyll`, commit and `git push`, then curl the live URL until the new content appears (Pages rebuilds in about a minute). Also refresh `snehal-in-japan-site.zip`. Related: project-japan-trip-nov-2026.md.

## google-maps-shared-list-parsing

maps.app.goo.gl short links for shared lists resolve to `google.com/maps/@/data=!…!11m2!2s<listId>!3e3`. The server-rendered HTML carries no list data; the page fetches `https://www.google.com/maps/preview/entitylist/getlist?…` (XHR). In the built-in browser, open the list, then in `javascript_tool` find that URL via `performance.getEntriesByType('resource')`, `fetch` it with credentials, strip the `)]}'` prefix, `JSON.parse`; `d[0][4]` = list title, `d[0][8]` = items; item `[2]` name, `[3]` user note, `[1][2]`/`[1][4]` address, `[1][5][2..3]` lat/lng, `[1][6]` = [fid, cid] (cid is a signed int64; `https://maps.google.com/?cid=<unsigned>` opens the exact place).

Place details in bulk: open any place page, grab its `preview/place?…pb=…%211s0x0%3A0x<cidhex>…` URL from performance entries, substitute each place's cid hex, fetch; in the response `e=d[6]`: `e[11]` name, `e[4][7]` rating, `e[4][8]` review count, `e[13]` categories, `e[39]` address, `e[203][0]` weekly hours as `[dayName, idx, [y,m,d], [["10 am–10 pm", …]] …]` (null ranges = closed). ~80 places in three ~25-item batches worked without rate limiting. curl without the page's cookies/JS only returns the Maps shell.

**How to apply:** Reuse when Snehal shares more Maps lists (the lists are "not complete and will be updated"). Related: project-japan-trip-nov-2026.md.
