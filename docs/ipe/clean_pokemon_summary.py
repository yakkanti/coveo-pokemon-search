# Coveo indexing pipeline extension (post-conversion).
#
# The web scraping configuration extracts the intro paragraphs of each Pokémon page as <p> elements, so
# pokemon_summary arrives as HTML (and Coveo joins multiple paragraphs with ";"). This rewrites the field as plain
# text, one blank line between paragraphs, so search, RGA citations and Passage Retrieval clients all get clean text.
#
# `document` and `log` are provided by the Coveo extension runtime; beautifulsoup4 is available there.
from bs4 import BeautifulSoup

FIELD = "pokemon_summary"

try:
    values = document.get_meta_data_value(FIELD)
    if values:
        soup = BeautifulSoup("".join(values), "html.parser")
        # get_text() without a separator keeps inline markup intact ("Fire/Flying", not "Fire / Flying").
        paragraphs = [" ".join(p.get_text().split()) for p in soup.find_all("p")] or [" ".join(soup.get_text().split())]
        paragraphs = [p for p in paragraphs if p]
        if paragraphs:
            document.add_meta_data({FIELD: "\n\n".join(paragraphs)})
            log(f"{FIELD}: cleaned {len(paragraphs)} paragraph(s)")
except Exception as e:
    log(f"{FIELD}: {e}", "Error")
