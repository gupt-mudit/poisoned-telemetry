"""Convert an EU Official Journal XHTML (from CELLAR) into plain text for the KB.

Text is kept verbatim. The only additions: a provenance header, and a "§§ " marker in front of
each real article/annex heading so kb/articles.py can tell headings from cross-references.
usage: python -I eurlex_to_txt.py <in.xhtml> <out.txt> <title> <celex> <eli_url>
"""
import re
import sys
import xml.etree.ElementTree as ET

src, out, title, celex, url = sys.argv[1:6]
NS = "{http://www.w3.org/1999/xhtml}"
root = ET.parse(src).getroot()


def text(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


lines = [f"{title}", f"Official source: {url} (CELEX {celex}, English, Official Journal of the EU)",
         "Retrieved 2026-11-04 via the EU Publications Office (CELLAR). © European Union. Reuse authorised "
         "with acknowledgement of the source (Commission Decision 2011/833/EU). Only the OJ version is authentic.",
         "Markers '§§' were added before article/annex headings for citation; the legal text is unchanged.", ""]
pending_art = None
seen_recitals = False
for el in root.iter():
    if el.tag not in (NS + "p", NS + "td") or el.tag == NS + "td" and el.find(NS + "p") is not None:
        continue
    cls = el.get("class", "")
    t = text(el)
    if not t:
        continue
    if cls == "oj-ti-art":
        pending_art = t                      # e.g. "Article 23"
        continue
    if cls == "oj-sti-art" and pending_art:
        lines += ["", f"§§ {pending_art} — {t}"]
        pending_art = None
        continue
    if pending_art:                          # article without a subtitle
        lines += ["", f"§§ {pending_art}"]
        pending_art = None
    if cls == "oj-doc-ti" and re.match(r"^ANNEX\b", t):
        lines += ["", "§§ Annex " + t.split(None, 1)[1] if " " in t else "§§ Annex"]
        continue
    if not seen_recitals and re.match(r"^\(1\)$", t):
        lines += ["", "§§ Recitals"]
        seen_recitals = True
    if el.tag == NS + "td" and re.fullmatch(r"\(\w{1,4}\)|\d+\.", t):
        lines.append(t)                      # list number cell; joined with the next cell below
        continue
    if lines and re.fullmatch(r"\(\w{1,4}\)|\d+\.", lines[-1]):
        lines[-1] = f"{lines[-1]} {t}"
    else:
        lines.append(t)

# keep the enacting terms only (articles + annexes): recitals are not binding and crowd out
# the provisions agents must cite. The header says so.
start = next(i for i, l in enumerate(lines) if l.startswith("§§ Article 1 "))
head = lines[:5] + ["Recitals omitted (non-binding); see the official URL for the full text.", ""]
lines = head + lines[start:]
body = "\n".join(lines) + "\n"
open(out, "w", encoding="utf-8").write(body)
arts = re.findall(r"^§§ Article (\d+)", body, re.M)
print(f"{out}: {len(body.split())} words, {len(arts)} articles (first {arts[:1]}, last {arts[-1:]})")
