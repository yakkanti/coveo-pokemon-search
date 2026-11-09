# Coveo indexing pipeline extension (post-conversion).
#
# 1. pokemon_summary: the web scraping configuration extracts the intro paragraphs as <p> elements, so the field
#    arrives as HTML (Coveo joins multiple paragraphs with ";"). Rewrite it as plain text, one blank line between
#    paragraphs, so search, RGA citations and Passage Retrieval clients all get clean text.
# 2. pokemon_weak_to / pokemon_resists / pokemon_immune_to: scraped from the type chart's cell tooltips, which read
#    "Electric → Water/Flying = super-effective". Keep only the attacking type ("Electric"), so the fields work as
#    facets and filters.
#
# `document` and `log` are provided by the Coveo extension runtime; beautifulsoup4 is available there.
from bs4 import BeautifulSoup

SUMMARY = "pokemon_summary"
TYPE_FIELDS = ["pokemon_weak_to", "pokemon_resists", "pokemon_immune_to"]


def values_of(field):
    values = document.get_meta_data_value(field)
    if not values:
        return []
    # Multi-value metadata can arrive as one ";"-joined string or as a list, depending on the stage.
    return [v.strip() for value in values for v in str(value).split(";") if v.strip()]


try:
    values = document.get_meta_data_value(SUMMARY)
    if values:
        soup = BeautifulSoup("".join(values), "html.parser")
        # get_text() without a separator keeps inline markup intact ("Fire/Flying", not "Fire / Flying").
        paragraphs = [" ".join(p.get_text().split()) for p in soup.find_all("p")] or [" ".join(soup.get_text().split())]
        paragraphs = [p for p in paragraphs if p]
        if paragraphs:
            document.add_meta_data({SUMMARY: "\n\n".join(paragraphs)})
            log(f"{SUMMARY}: cleaned {len(paragraphs)} paragraph(s)")
except Exception as e:
    log(f"{SUMMARY}: {e}", "Error")

for field in TYPE_FIELDS:
    try:
        raw = values_of(field)
        if raw:
            types = []
            for title in raw:
                attacker = title.split("→")[0].strip()
                if attacker and attacker not in types:
                    types.append(attacker)
            document.add_meta_data({field: types})
            log(f"{field}: {', '.join(types)}")
    except Exception as e:
        log(f"{field}: {e}", "Error")
