export const SOURCES = [
  {
    id: "mirelman2013",
    title: "Sam Mirelman · Tuning Procedures in Ancient Iraq (2013)",
    url: "https://journal.iftawm.org/previous/vol2no2/mirelman/",
    note: "Analytical Approaches to World Music 2(2), 43–56. String names: p. 46; two manuscripts and uncertain instrument: pp. 47–48; preserved/restored clauses: pp. 49–52; seven tunings: fig. 5, p. 52; tightening: pp. 53–54.",
  },
  {
    id: "rahn2022",
    title: "Jay Rahn · Was Mesopotamian Tuning Diatonic? A Parsimonious Answer (2022)",
    url: "https://mtosmt.org/issues/mto.22.28.1/mto.22.28.1.rahn.html",
    note: "Music Theory Online 28.1. DOI 10.30535/mto.28.1.7. Paragraphs 9–16 distinguish physical strings from later pitch concepts and explain the reversible seven-name network; later sections examine assumptions behind an audible reconstruction.",
  },
  {
    id: "mirelmanKrispijn2009",
    title:
      "Sam Mirelman & Theo J. H. Krispijn · The Old Babylonian tuning text UET VI/3 899 (2009)",
    url: "https://doi.org/10.1017/S0021088900000735",
    note: "Iraq 71, 43–52. Edition of the second manuscript. Read with UET VII 74; the two witnesses are separate tablets, not joining fragments of one tablet.",
  },
  {
    id: "uet74",
    title: "CDLI P347039 · UET VII 74",
    url: "https://cdli.earth/artifacts/347039",
    note: "Catalogue record for one tuning manuscript from Ur, Old Babylonian period. The British Museum witness discussed by Mirelman is a cast; do not infer the original tablet’s present location from the catalogue’s collection field.",
  },
  {
    id: "cbs10996",
    title: "CDLI P254475 · CBS 10996",
    url: "https://cdli.earth/artifacts/254475",
    note: "Later witness for named string pairs. The catalogue checked on 22 October 2026 assigns Middle Babylonian, approximately 1400–1100 BCE; Mirelman (2013) used an older Neo-Babylonian dating. Combining witnesses is a scholarly reconstruction across time.",
  },
  {
    id: "hoyrup2017",
    title: "Jens Høyrup · Algebra in Cuneiform, Appendix B (2017)",
    url: "https://mprl-series.mpg.de/textbooks/2/12/index.html",
    note: "Key to Vocabulary and Standard Translations: šumma, ‘if’. This is lexical support from a study of mathematical texts, not another witness to the musical procedure. The action verbs are discussed by Rahn (2022), paragraph 45.",
  },
] as const;

export const WORDS = [
  [
    "sammû",
    "a stringed instrument",
    "Its precise identification as harp or lyre is unsettled. The diagram here describes string relationships, not its archaeological shape.",
  ],
  [
    "zakû",
    "clear / clean / pure",
    "A source term for a pair of strings. Its musical meaning is interpreted; it is not a recorded numerical frequency ratio.",
  ],
  [
    "lā zakû",
    "not clear",
    "The diagnostic pair distinguishes one named tuning from another. The spelling here is normalized Akkadian romanization.",
  ],
  [
    "išartum",
    "straight / normal",
    "Both the name of strings 2 + 6 and the name of a tuning. Pair names and tuning names do different jobs.",
  ],
  [
    "kitmum",
    "closed",
    "A tuning name and a pair name: strings 6 + 3. The same pair can be clear in one tuning and unclear in another.",
  ],
  [
    "qablītum",
    "middle",
    "Names strings 5 + 2. In išartum tuning this is the diagnostic unclear pair; after loosening string 2 it is clear.",
  ],
  [
    "nê'um",
    "to loosen",
    "Intact and partly preserved forms occur in the loosening chapter. They support the physical direction assigned to that action. See Rahn (2022), paragraph 45.",
  ],
  [
    "nasāḫum",
    "to remove / subtract; ‘tighten’ here",
    "Editors restore the verb in the tightening instructions. A partly preserved concluding rubric supports this contextual interpretation. It does not mean ‘tighten’ in every Akkadian setting. See Rahn (2022), paragraph 45.",
  ],
  [
    "šumma",
    "if",
    "Introduces a condition. In a procedural case, distinguish that condition from the instructed action and its result. Lexical support: Høyrup (2017), Appendix B; the tuning text’s conditional format is discussed by Mirelman (2013), pp. 49–50.",
  ],
] as const;

export const MODEL_STATEMENT =
  "An audible fourths-and-fifths realization, not a recovered ancient performance. Six designated pairs are set to frequency ratios 4/3 or 3/2. Reference pitch, numerical precision, sound colour and the companion-string octave/unison choice are modern settings. The tablets do not record frequencies in hertz or these fractions.";

export interface Clause {
  readonly title: string;
  readonly summary: string;
  readonly evidence: string;
  readonly preservation: string;
}

/** Original summaries, not a reproduction of the copyrighted edition/translation. */
export const CLAUSES: readonly Clause[] = [
  {
    title: "išartum → kitmum",
    summary:
      "Begin in išartum. Test qablītum, strings 5 + 2. Loosen the following string and the back string: 2 + 9. The resulting tuning is kitmum.",
    evidence: "Loosening section, lines 13–16; Mirelman 2013, pp. 49–52.",
    preservation:
      "The word describing the pair as unclear is supplied by the editor as an omission, marked ⟨ ⟩ in the edition. The case is not an entirely untouched ancient sentence.",
  },
  {
    title: "kitmum → embūbum",
    summary:
      "Begin in kitmum. Test išartum, strings 2 + 6. Loosen the fourth string from behind: 6. The reconstructed result is embūbum.",
    evidence: "Loosening section, lines 17–20; Mirelman 2013, pp. 51–52.",
    preservation:
      "The result clause is restored across a break, marked [ ] in the edition. The diagnostic pair and action are preserved in the published translation.",
  },
  {
    title: "embūbum → pītum",
    summary:
      "The reconstructed case tests kitmum, strings 6 + 3, and loosens string 3. Its destination is pītum.",
    evidence: "Loosening section, lines 21–24; Mirelman 2013, p. 52.",
    preservation:
      "Almost all of this case is restored in [ ]; the final tuning name survives. Its place in the pattern is an editorial reconstruction, not an equally preserved instruction.",
  },
];
