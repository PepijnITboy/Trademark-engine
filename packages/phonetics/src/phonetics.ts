const VOWELS = "AEIOU";
const SILENT_START = new Set(["GN", "KN", "PN", "WR", "PS"]);

function isVowel(ch: string): boolean {
  return VOWELS.includes(ch);
}

function metaphonePrimary(input: string): string {
  let word = input.toUpperCase().replace(/[^A-Z]/g, "");
  if (!word) {
    return "";
  }

  if (word.startsWith("X")) {
    word = "S" + word.slice(1);
  }

  const out: string[] = [];
  let i = 0;

  if (SILENT_START.has(word.slice(0, 2))) {
    i = 1;
  }

  while (i < word.length && out.length < 4) {
    const ch = word[i]!;
    const next = word[i + 1] ?? "";
    const prev = out[out.length - 1] ?? "";

    switch (ch) {
      case "A":
      case "E":
      case "I":
      case "O":
      case "U":
        if (i === 0) {
          out.push(ch);
        }
        break;
      case "B":
        if (prev !== "M" || next) {
          out.push("P");
        }
        break;
      case "C":
        if (next === "H") {
          out.push("X");
          i++;
        } else if (next === "I" || next === "E" || next === "Y") {
          out.push("S");
        } else {
          out.push("K");
        }
        break;
      case "D":
        if (next === "G" && (word[i + 2] === "E" || word[i + 2] === "I" || word[i + 2] === "Y")) {
          out.push("J");
          i += 2;
        } else {
          out.push("T");
        }
        break;
      case "F":
        out.push("F");
        break;
      case "G":
        if (next === "H" && !isVowel(word[i + 2] ?? "")) {
          i++;
        } else if (next === "N" && i + 2 === word.length) {
          i++;
        } else if (next === "I" || next === "E" || next === "Y") {
          out.push("J");
        } else {
          out.push("K");
        }
        break;
      case "H":
        if (isVowel(prev) && isVowel(next)) {
          out.push("H");
        }
        break;
      case "J":
        out.push("J");
        break;
      case "K":
        if (prev !== "C") {
          out.push("K");
        }
        break;
      case "L":
        out.push("L");
        break;
      case "M":
        out.push("M");
        break;
      case "N":
        out.push("N");
        break;
      case "P":
        if (next === "H") {
          out.push("F");
          i++;
        } else {
          out.push("P");
        }
        break;
      case "Q":
        out.push("K");
        break;
      case "R":
        out.push("R");
        break;
      case "S":
        if (next === "H") {
          out.push("X");
          i++;
        } else if (word.slice(i, i + 3) === "SIO" || word.slice(i, i + 3) === "SIA") {
          out.push("X");
        } else {
          out.push("S");
        }
        break;
      case "T":
        if (next === "H") {
          out.push("0");
          i++;
        } else if (word.slice(i, i + 3) === "TIO" || word.slice(i, i + 3) === "TIA") {
          out.push("X");
        } else {
          out.push("T");
        }
        break;
      case "V":
        out.push("F");
        break;
      case "W":
        if (isVowel(next)) {
          out.push("W");
        }
        break;
      case "X":
        out.push("KS");
        break;
      case "Y":
        if (i === 0 || isVowel(next)) {
          out.push("Y");
        }
        break;
      case "Z":
        out.push("S");
        break;
      default:
        break;
    }

    const last = out[out.length - 1];
    while (i + 1 < word.length && word[i + 1] === ch && last === out[out.length - 1]) {
      i++;
    }
    i++;
  }

  return out.join("").padEnd(4, "0").slice(0, 4);
}

function metaphoneSecondary(input: string): string {
  let word = input.toUpperCase().replace(/[^A-Z]/g, "");
  if (!word) {
    return "";
  }

  const out: string[] = [];
  let i = 0;

  while (i < word.length && out.length < 4) {
    const ch = word[i]!;
    const next = word[i + 1] ?? "";

    if (ch === "C" && next === "H") {
      out.push("X");
      i += 2;
      continue;
    }
    if (ch === "S" && next === "H") {
      out.push("X");
      i += 2;
      continue;
    }
    if (ch === "P" && next === "H") {
      out.push("F");
      i += 2;
      continue;
    }
    if (isVowel(ch)) {
      if (i === 0) {
        out.push("A");
      }
    } else if (ch === "C") {
      out.push("K");
    } else if (ch === "G") {
      out.push("K");
    } else if (ch === "Z") {
      out.push("S");
    } else if (ch === "D" && next === "G") {
      out.push("J");
      i += 2;
      continue;
    } else {
      out.push(ch);
    }
    i++;
  }

  return out.join("").padEnd(4, "0").slice(0, 4);
}

export type DoubleMetaphoneResult = {
  primary: string;
  secondary: string;
};

export function doubleMetaphone(input: string): DoubleMetaphoneResult {
  return {
    primary: metaphonePrimary(input),
    secondary: metaphoneSecondary(input),
  };
}

/** German Cologne phonetics (Kölner Phonetik). */
export function colognePhonetic(input: string): string {
  let word = input.toUpperCase().replace(/[^A-ZÄÖÜß]/g, "");
  if (!word) {
    return "";
  }

  word = word
    .replace(/Ä/g, "A")
    .replace(/Ö/g, "O")
    .replace(/Ü/g, "U")
    .replace(/ß/g, "SS");

  const rules: ReadonlyArray<[RegExp, string]> = [
    [/^C[AHKLOU]/, "4"],
    [/^CH/, "4"],
    [/^CK/, "4"],
    [/^CL/, "4"],
    [/^CO/, "4"],
    [/^CU/, "4"],
    [/^CQ/, "4"],
    [/^CX/, "4"],
    [/^C/, "8"],
    [/^D[CSZ]/, "8"],
    [/^D/, "8"],
    [/^G[EIY]/, "4"],
    [/^G/, "4"],
    [/^H/, ""],
    [/^P[FH]/, "3"],
    [/^PH/, "3"],
    [/^P/, "3"],
    [/^Q/, "4"],
    [/^T[CSZ]/, "8"],
    [/^TH/, "8"],
    [/^T/, "8"],
    [/^X/, "48"],
    [/^Y/, "1"],
    [/^Z/, "8"],
  ];

  const digitMap: Readonly<Record<string, string>> = {
    A: "0",
    E: "0",
    I: "0",
    O: "0",
    U: "0",
    B: "1",
    P: "1",
    D: "2",
    T: "2",
    F: "3",
    V: "3",
    W: "3",
    C: "4",
    G: "4",
    J: "4",
    K: "4",
    Q: "4",
    S: "4",
    X: "4",
    Z: "4",
    L: "5",
    M: "6",
    N: "6",
    R: "7",
  };

  let out = "";
  let i = 0;
  while (i < word.length) {
    let matched = false;
    for (const [re, digit] of rules) {
      if (re.test(word.slice(i))) {
        out += digit;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += digitMap[word[i]!] ?? "";
    }
    i++;
  }

  return out.replace(/(.)\1+/g, "$1").replace(/0+$/, "");
}

/** NYSIIS phonetic encoding. */
export function nysiis(input: string): string {
  let word = input.toUpperCase().replace(/[^A-Z]/g, "");
  if (!word) {
    return "";
  }

  if (word.startsWith("MAC")) {
    word = "MCC" + word.slice(3);
  } else if (word.startsWith("KN")) {
    word = "NN" + word.slice(2);
  } else if (word.startsWith("K")) {
    word = "C" + word.slice(1);
  } else if (word.startsWith("PH") || word.startsWith("PF")) {
    word = "FF" + word.slice(2);
  } else if (word.startsWith("SCH")) {
    word = "SSS" + word.slice(3);
  }

  word = word
    .replace(/EV/g, "AF")
    .replace(/[AEIOU]/g, "A")
    .replace(/Q/g, "G")
    .replace(/Z/g, "S")
    .replace(/M/g, "N")
    .replace(/KN/g, "N")
    .replace(/K/g, "C")
    .replace(/PH/g, "F")
    .replace(/SH/g, "S")
    .replace(/TH/g, "T");

  if (word.endsWith("DT") || word.endsWith("RT") || word.endsWith("RD") || word.endsWith("NT")) {
    word = word.slice(0, -2) + "D";
  }

  let out = word[0] ?? "";
  for (let i = 1; i < word.length; i++) {
    const ch = word[i]!;
    if (ch !== "A" && ch !== out[out.length - 1]) {
      out += ch;
    }
  }

  return out.replace(/S$/, "").replace(/AY$/, "Y").replace(/A$/, "");
}

const DUTCH_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/ij/g, "y"],
  [/ph/g, "f"],
  [/oe/g, "u"],
  [/eu/g, "u"],
  [/ui/g, "uy"],
  [/ch/g, "g"],
  [/sch/g, "sx"],
  [/s/g, "z"],
  [/z/g, "s"],
];

/** Dutch-oriented replacement key with optional vowel stripping. */
export function dutchReplacementKey(input: string, stripVowels = true): string {
  let word = input.toLowerCase().replace(/[^a-z]/g, "");
  for (const [re, replacement] of DUTCH_REPLACEMENTS) {
    word = word.replace(re, replacement);
  }
  if (stripVowels) {
    word = word.replace(/[aeiouy]/g, "");
  }
  return word;
}

/** Consonant-only skeleton after basic normalization. */
export function consonantSkeleton(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z]/g, "")
    .replace(/[aeiouy]/g, "");
}

export const PHONETIC_KEY_LOCALE = "und";
export const PHONETIC_ALGORITHMS = ["double_metaphone", "nysiis"] as const;

export type PhoneticKeyAlgorithm = (typeof PHONETIC_ALGORITHMS)[number];

export type PhoneticKeyRecord = {
  readonly locale: string;
  readonly algorithm: PhoneticKeyAlgorithm;
  readonly key: string;
};

/**
 * Stable phonetic key rows for persistence and retrieval lookup.
 * Uses Double Metaphone (primary + secondary) and NYSIIS.
 */
export function buildPhoneticKeyRecords(input: string): PhoneticKeyRecord[] {
  const cleaned = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

  if (!cleaned) {
    return [];
  }

  const records: PhoneticKeyRecord[] = [];
  const seen = new Set<string>();

  const push = (algorithm: PhoneticKeyAlgorithm, key: string): void => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return;
    }
    const dedupe = `${algorithm}:${normalizedKey}`;
    if (seen.has(dedupe)) {
      return;
    }
    seen.add(dedupe);
    records.push({
      locale: PHONETIC_KEY_LOCALE,
      algorithm,
      key: normalizedKey,
    });
  };

  const metaphone = doubleMetaphone(cleaned);
  push("double_metaphone", metaphone.primary);
  push("double_metaphone", metaphone.secondary);
  push("nysiis", nysiis(cleaned));

  return records;
}
