# AZ Turf Suppliers — Editor Guide

Welcome to the CloudCannon editor for AZ Turf Suppliers. Here's everything you need to know to manage the site.

---

## Site sections

The sidebar is split into four groups:

### Site
Core pages — Homepage, About, Contact, Gallery, Products listing, Locations listing, and the Contractors, Homeowners, and Turf Calculator pages.

### Product Pages
Individual product pages for each turf variety, pavers, natural stone, putting green, and landscape lighting.

### Location Pages
City-specific landing pages: Apache Junction, Chandler, Gilbert, Mesa, Phoenix, Queen Creek, San Tan Valley, Scottsdale, and Tempe.

### Data
Data files that power site features. Currently this contains **gallery.json**, which controls the hover labels on the Gallery page.

---

## Editing pages

Open any page from the sidebar and it will open in the **visual editor** — you can see the live site as you work. Click any text or image on the page to edit it in place.

Changes are saved as a draft until you publish.

---

## Adding gallery image labels

By default, gallery photos show no hover text. To add a title and/or location label to a photo:

1. Open **Data → gallery.json** in the sidebar.
2. Under `overrides`, add the exact filename as a key (e.g. `turf--01.jpg`).
3. Add a `title` (short description shown in bold) and/or `location` (city name, shown smaller).

Example:
```json
"overrides": {
  "turf--01.jpg": {
    "title": "Backyard Transformation",
    "location": "Queen Creek"
  }
}
```

> **Filenames are case-sensitive.** They must match exactly what's in the gallery folder.

---

## Adding gallery photos

Drop new image files into `src/assets/gallery/` following the naming convention in `HOW-TO-NAME-FILES.txt`. The gallery page picks them up automatically on the next build.

---

## ⚠️ Build note

This site uses the **Cloudflare adapter** for deployment. If CloudCannon previews appear broken, contact your developer — the build adapter may need to be switched to static mode for the CloudCannon preview environment, while keeping the Cloudflare adapter for production deploys.
