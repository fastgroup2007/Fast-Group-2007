# Catalog and maintenance update — 21 October 2026

The published defaults retain the existing 67 Carrier/Midea products and add 190 catalog entries, including 8 separately documented Sharp color codes. Total: 257.

## Verified changes

- Visible wrapping buttons for all eight brands; search, capacity, type, category, price and comparison work with the expanded catalog.
- Model/color-specific primary photos for 161 added entries, hosted in catalog-images. Each record carries its source URL and matched model. Identical supplier-assigned photos can serve multiple exact product pages; no capacity-only or brand-only fallback is assigned.
- Sharp white/black/silver/red variations have separate codes. The eight extra color codes are absent from the supplied price list and explicitly show price/availability on request.
- Supplier list prices are preserved; Fresh EIFF floor-standing entries are labeled dealer prices. The conflicting Fresh SFW24H 2.25 HP row is flagged for supplier confirmation.
- Default refrigerant is R410A where not provided; explicit source gas remains. Extra details are shown only when supported.
- Public maintenance section and validated request form. The customer reviews a message and opens business WhatsApp on 01013283466; they must send it themselves. The site does not claim a booking or store customer request data.
- Migration backs up prior catalog storage, updates untouched legacy fields and retains manual prices, photos, models, custom products and deletion markers. Existing CRM and stock data are not modified by this update.

## Validation

Node migration tests: legacy upgrade, custom prices/images/models, duplicate prevention, repeat-load stability, deletion markers, invalid JSON/shape retention, backup, image-source linkage, exact Sharp red codes. Maintenance tests: Arabic/Persian/Egyptian phones, required fields, length limits and URL encoding. Existing nine stock/history/correction tests pass.

Browser checks at desktop and 390px: all eight brand filters, result counts, exact color image/code changes, modal close, maintenance invalid/valid form and preview invalidation. No JavaScript errors observed. Test preview had production sync disabled; no test WhatsApp messages were sent.

## Images still requiring supplier confirmation (29)

These entries display an explicit missing-photo message. Do not substitute a similar product photo. The inherited 67 Carrier/Midea primary images were preserved and are outside the new image-source audit.

| Brand | Model | Capacity |
| --- | --- | --- |
| Sharp | AH-AP12YHE | 1.5 |
| Sharp | AY-A12YSE | 1.5 |
| Sharp | AH-A18YSE | 2.25 |
| Sharp | AH-AP18YHE | 2.25 |
| Sharp | AY-AP18YHE | 2.25 |
| Sharp | AH-A24YSE | 3 |
| Sharp | AH-AP24YHE | 3 |
| Sharp | AY-A24YSE | 3 |
| Sharp | GB-X36BME | 5 |
| LG | AP-W36GT3E4 | 5 |
| LG | AP-W60GT3E6 | 7.5 |
| Fresh | FUFW09C/IW-AG - FUFW09C/O-X1 | 1.25 |
| Fresh | SFW24H/IP-AG - SFW24H/O-X4 | 2.25 |
| Fresh | SFW24H/IP-AG - SFW24H/O-X4 | 3 |
| Fresh | X-SIFW30H/IP-R32 - X-SIFW30H/O-R32 | 4 |
| Fresh | X-SIFW36H/IP-R32 - X-SIFW36H/O-R32 | 5 |
| Fresh | UIFD48H/IW R410A - UIFD48H/O R410A | 6 |
| Fresh | EIFF36H/O-R410a-T3 - EIFF36H/IW-R410a-T3 | 5 |
| Fresh | EIFF48H/IW-R410a-T3 - EIFF48H/O-R410a-T3 | 6 |
| Fresh | EIFF60H/IW-R410a-T3 - EIFF60H/O-R410a-T3 | 7.5 |
| Haier | Smart Ultra Black 12000 BTU H/C | 1.5 |
| Haier | Smart Ultra Black 18000 BTU H/C | 2.25 |
| Haier | Smart Ultra Black 24000 BTU H/C | 3 |
| Haier | Smart Titan 36000 BTU H/C | 5 |
| Haier | AP36KH1EAA/1U36IH1EAM | 5 |
| Haier | AP48KH1EAA/1U48IH1EAN | 6 |
| Haier | AP60KH1EAA/1U60PH1EAN | 7.5 |
| Fresh | Air Curtain 120cm | — |
| Fresh | Air Curtain 90cm | — |

Source lists: ELARABY AC 19 Aug 2026 Price List D.pdf; 2026 LG AC Price 15, June.pdf; FRESH PL 06.2026.pdf; supplied Haier June and Free Air March 2026 tables. Photo/spec evidence is stored per product in catalog-data.js.

## Follow-up requested by owner
- Restored the original responsive grid: two compact columns on mobile, original laptop/desktop breakpoints. Restored WhatsApp, quote request and model-copy actions; combined request text includes model, color, price and delivery/installation confirmation.
- Header stays at the top, with brand filters pinned below it while browsing the catalog. Verified header top 0 and filter top equal to header height after scrolling.
- Added blower, wash-bag and chemical cleaning explanations and a validated service choice in the maintenance message.
- Passed 11 Node test cases/suites and browser checks at 390px and 1366px. The separate legacy crm-browser.cjs runner could not start because Playwright is not installed; browser checks used the connected browser instead.
