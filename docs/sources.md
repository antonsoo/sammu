# Source ledger

Reviewed 22 October 2026. This ledger distinguishes the ancient evidence, its modern scholarly reconstruction, and the implementation’s chosen numerical realization.

## Publications read

| Source                                                                                                                                                                                                       | Location used                                                                                                         | Role in the workshop                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sam Mirelman, “Tuning Procedures in Ancient Iraq,” _Analytical Approaches to World Music_ 2(2), 2013, 43–56. [Article and complete PDF](https://journal.iftawm.org/previous/vol2no2/mirelman/)               | pp. 46–48; fig. 4–5 on p. 52; pp. 53–55                                                                               | Nine string names; paired changes; uncertain instrument; two manuscripts; preservation of three cases; seven tuning/pair relationships; physical loosening and tightening.                                                                       |
| Sam Mirelman and Theo J. H. Krispijn, “The Old Babylonian tuning text UET VI/3 899,” _Iraq_ 71, 2009, 43–52. [DOI](https://doi.org/10.1017/S0021088900000735)                                                | Publisher metadata and abstract; indexed text of p. 46; the later 2013 paper’s account and quotations of this edition | Edition of a second witness. The full 2009 article could not be fetched during review; the indexed p. 46 passage was checked for the cast/original distinction, but we do not claim a fresh collation of its Akkadian text or tablet photograph. |
| Jay Rahn, “Was Mesopotamian Tuning Diatonic? A Parsimonious Answer,” _Music Theory Online_ 28.1, March 2022. [Article](https://mtosmt.org/issues/mto.22.28.1/mto.22.28.1.rahn.html), DOI 10.30535/mto.28.1.7 | paragraphs 9–16, 44–48, 58–61; examples 11–12                                                                         | Separating spatial string relationships from later pitch concepts; opposite directions; short retuning routes; assumptions involved in interpreting the pair qualities; a fourths/fifths realization.                                            |
| [CDLI P347039](https://cdli.earth/artifacts/347039)                                                                                                                                                          | Catalogue: UET 7, 0074; period; provenance; publication                                                               | Identifies UET VII 74, from Ur, Old Babylonian, approximately 1900–1600 BCE in the catalogue.                                                                                                                                                    |
| [CDLI P254475](https://cdli.earth/artifacts/254475)                                                                                                                                                          | Catalogue: CBS 10996; period; provenance; museum                                                                      | Identifies the later string-pair witness at the Penn Museum. The catalogue assigns Middle Babylonian, approximately 1400–1100 BCE.                                                                                                               |

The 2009 DOI above ends in `0735`. A repository metadata result returned a different DOI and an unrelated abstract; the publisher’s record was used to resolve the citation.

## Preserve the source’s boundaries

The two tuning witnesses are separate tablets, not two physically joining fragments. In discussing UET VII 74, the 2009 authors (p. 46) distinguish the British Museum cast from the original, which they report had been returned to Baghdad. The CDLI collection field by itself should not be read as proof of the original’s current location.

CBS 10996 is later than the Old Babylonian tuning manuscripts. Its present CDLI period assignment differs from the older Neo-Babylonian dating in Mirelman (2013). The app reports the discrepancy instead of choosing an artificially precise date or implying contemporaneity.

Source pair ordering is preserved, including 5 + 2, 6 + 3 and 4 + 1. These numbers denote physical string positions. They are not Western scale degrees, pitch classes, a keyboard numbering scheme, or measured string lengths.

The source term _sammû_ identifies a stringed instrument. Calling it a particular excavated lyre, reproducing that instrument’s outline, or selecting a modern instrument sample as its recovered sound would add evidence we do not have. The app uses an original numerical diagram and explicitly synthetic partials.

## Preservation of the three displayed cases

These are original summaries, not a reproduced modern translation. Line numbers follow the edition cited in Mirelman (2013), pp. 49–52.

| Loosening case   | Line numbers | Preservation stated in the published translation                                                      |
| ---------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| išartum → kitmum | 13–16        | The description of qablītum as unclear is supplied as a scribal omission, marked with angle brackets. |
| kitmum → embūbum | 17–20        | The result clause identifying embūbum is restored across a break, marked with square brackets.        |
| embūbum → pītum  | 21–24        | Almost the entire clause is restored; the destination tuning name remains.                            |

The workshop does not assign a false line-by-line preservation status to all fourteen reconstructed transitions. The complete network is labelled a reconstruction, with these three neighboring examples showing why that label matters. Tightening terminology is itself partly restored; Rahn (2022), paragraph 45 discusses the inference and its lexical basis.

## The seven-tuning mapping

Mirelman (2013), fig. 5, p. 52 provides the named clear and diagnostic unclear pairs. The opposite actions follow the two reconstructed chapter directions discussed on pp. 53–54 and by Rahn (2022), paragraphs 11–16.

| Tuning        | Named clear pair | Diagnostic unclear pair | Loosen | Tighten |
| ------------- | ---------------- | ----------------------- | ------ | ------- |
| išartum       | 2 + 6            | 5 + 2                   | 2 + 9  | 5       |
| kitmum        | 6 + 3            | 2 + 6                   | 6      | 2 + 9   |
| embūbum       | 3 + 7            | 6 + 3                   | 3      | 6       |
| pītum         | 7 + 4            | 3 + 7                   | 7      | 3       |
| nīd(i) qablim | 4 + 1            | 7 + 4                   | 4      | 7       |
| nīš tuḫrim    | 1 + 5            | 4 + 1                   | 1 + 8  | 4       |
| qablītum      | 5 + 2            | 1 + 5                   | 5      | 1 + 8   |

## What we choose to make it audible

The exact frequency ratios 4/3 and 3/2, a descending pitch ordering for strings 1–7, an initial hertz reference, a companion-string unison/lower-octave relationship, additive sine partials, envelope times and digital precision are model settings. The source text does not record those numerical frequencies. The role of assumptions is discussed by both Mirelman (2013), pp. 54–55 and Rahn (2022), especially paragraphs 44–59.

Our exact constraints and operations imply an alteration factor of 2048/2187 for loosening and its reciprocal for tightening. A same-direction seven-step name cycle shifts every pitch by that factor; a following opposite cycle restores them. This is a reproducible property of our mathematical realization, not a new philological discovery or an assertion about absolute ancient pitch.

Coinciding harmonic partials are shown as a physical property of the selected synthetic signal. The display is not an empirical reconstruction of an ancient listener’s response and does not settle the meaning of _zakû_.

The vocabulary uses normalized romanization. No cuneiform signs, reconstructed ancient pronunciation, or transliterated ancient sentence are invented.

## Reuse and assets

- The papers are linked in full, with author, title, publication, date and source locations. No article PDF, figure, excerpted image, audio example or tablet photograph is redistributed.
- Mirelman’s journal permits distribution of the whole article under restrictive noncommercial/no-modification terms. Those terms are not treated as permission to crop or adapt its figures. [Journal terms](https://journal.iftawm.org/previous/vol2no2/mirelman/).
- CDLI images have rights belonging to the relevant institutions/authors and publication restrictions. Its general text-reuse permission is not treated as a blanket photograph license. [CDLI terms](https://cdli.earth/terms-of-use).
- The pitch traces, overtone diagrams and tuning cycle drawing are original programmatic SVGs computed from the model. Their appearance does not reproduce a scholarly figure or the shape of an ancient object.
- Atkinson Hyperlegible Next and Noto Serif are self-hosted with their SIL Open Font License notices. The full notices are embedded in standalone studies.
