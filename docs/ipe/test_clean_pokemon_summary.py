# Local check for clean_pokemon_summary.py: runs the extension against a stand-in for Coveo's `document` object.
#   python3 -m venv .venv && .venv/bin/pip install beautifulsoup4
#   .venv/bin/python docs/ipe/test_clean_pokemon_summary.py
from pathlib import Path

SCRIPT = (Path(__file__).parent / "clean_pokemon_summary.py").read_text()

# What Coveo stored for Charizard before cleanup: two <p> elements joined with ";".
RAW = (
    '<p><em>Charizard</em> is a <a href="/type/fire" class="itype fire">Fire</a>/<a href="/type/flying" '
    'class="itype flying">Flying</a> type Pokémon introduced in <abbr title="Pokémon Red, Blue &amp; Yellow">'
    "Generation 1</abbr>. It is known as the <q>Flame Pokémon</q>.</p>;<p><em>Charizard</em> is a large "
    "dragon-like Pokémon, mainly orange in color. It has two large wings, the underside of which are turquoise. "
    "Like Charmander &amp; Charmeleon, it has a flame at the end of its tail.</p>"
)


class FakeDocument:
    def __init__(self, metadata):
        self.metadata = dict(metadata)

    def get_meta_data_value(self, name, origin=None, reverse=True):
        value = self.metadata.get(name)
        if value is None:
            return []
        return list(value) if isinstance(value, list) else [value]

    def add_meta_data(self, values):
        self.metadata.update(values)


def run(metadata):
    doc, logs = FakeDocument(metadata), []
    exec(SCRIPT, {"document": doc, "log": lambda msg, severity="Normal": logs.append((severity, msg))})
    return doc.metadata, logs


cleaned, logs = run({"pokemon_summary": RAW})
expected = (
    "Charizard is a Fire/Flying type Pokémon introduced in Generation 1. It is known as the Flame Pokémon.\n\n"
    "Charizard is a large dragon-like Pokémon, mainly orange in color. It has two large wings, the underside of "
    "which are turquoise. Like Charmander & Charmeleon, it has a flame at the end of its tail."
)
assert cleaned["pokemon_summary"] == expected, repr(cleaned["pokemon_summary"])
assert logs == [("Normal", "pokemon_summary: cleaned 2 paragraph(s)")], logs

# Type chart tooltips, scraped as Gyarados' real values, both as a list and as Coveo's ";"-joined form.
WEAK = ["Electric → Water/Flying = super-effective", "Rock → Water/Flying = super-effective"]
IMMUNE = "Ground → Water/Flying = no effect"
typed, logs = run({"pokemon_weak_to": WEAK, "pokemon_immune_to": IMMUNE,
                   "pokemon_resists": "Fire → Water/Flying = not very effective;Water → Water/Flying = not very effective"})
assert typed["pokemon_weak_to"] == ["Electric", "Rock"], typed["pokemon_weak_to"]
assert typed["pokemon_immune_to"] == ["Ground"], typed["pokemon_immune_to"]
assert typed["pokemon_resists"] == ["Fire", "Water"], typed["pokemon_resists"]
assert ("Normal", "pokemon_weak_to: Electric, Rock") in logs, logs

# Shedinja's tooltips carry its ability: "Normal → Bug/Ghost (Wonder Guard) = no effect".
shed, _ = run({"pokemon_immune_to": ["Normal → Bug/Ghost (Wonder Guard) = no effect"]})
assert shed["pokemon_immune_to"] == ["Normal"], shed["pokemon_immune_to"]

# Items without the fields (e.g. the national list page) are left alone.
untouched, logs = run({"title": "National Pokédex"})
assert "pokemon_summary" not in untouched and "pokemon_weak_to" not in untouched and logs == []

print("ok")
