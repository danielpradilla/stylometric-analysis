const FUNCTION_WORDS = [
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do",
  "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is",
  "it", "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of",
  "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same",
  "she", "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
  "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very",
  "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with",
  "would", "you", "your", "yours", "yourself", "yourselves"
];

const AI_MARKERS = [
  "overall", "moreover", "furthermore", "in conclusion", "it is important to note",
  "it is worth noting", "delve", "nuance", "robust", "leverage", "seamless", "tapestry",
  "underscores", "plays a crucial role", "not only", "but also"
];

const DEFAULT_OPTIONS = {
  caseSensitive: false,
  ignoreQuotes: false,
  mfwCount: 80,
  ngramSize: 3,
  sensitivity: "balanced"
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function stripQuotedBlocks(text) {
  return text
    .replace(/(^|\n)\s*>[^\n]*(?=\n|$)/g, " ")
    .replace(/"[^"]{20,}"/g, " ")
    .replace(/'[^']{20,}'/g, " ");
}

function prepareText(text, options = {}) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  let prepared = String(text || "").normalize("NFKC");
  if (merged.ignoreQuotes) prepared = stripQuotedBlocks(prepared);
  if (!merged.caseSensitive) prepared = prepared.toLowerCase();
  return normalizeWhitespace(prepared);
}

export function tokenizeWords(text, options = {}) {
  const prepared = prepareText(text, options);
  return prepared.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)?/gu) || [];
}

export function splitSentences(text, options = {}) {
  const prepared = prepareText(text, options);
  return prepared
    .split(/(?<=[.!?])\s+|[\n\r]+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function frequencyVector(items, vocabulary, scale = 1) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  const denominator = Math.max(items.length, 1);
  return vocabulary.map((item) => ((counts.get(item) || 0) / denominator) * scale);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] ** 2;
    magB += b[index] ** 2;
  }
  if (!magA || !magB) return 0;
  return clamp(dot / (Math.sqrt(magA) * Math.sqrt(magB)));
}

function distributionSimilarity(a, b) {
  const totalA = a.reduce((sum, value) => sum + value, 0) || 1;
  const totalB = b.reduce((sum, value) => sum + value, 0) || 1;
  let distance = 0;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    distance += Math.abs((a[index] || 0) / totalA - (b[index] || 0) / totalB);
  }
  return clamp(1 - distance / 2);
}

function relativeDifferenceSimilarity(a, b, tolerance = 0.55) {
  const denominator = Math.abs(a) + Math.abs(b) + 0.000001;
  return clamp(1 - Math.abs(a - b) / (denominator * tolerance));
}

function buildNgrams(text, size) {
  const normalized = prepareText(text, { caseSensitive: false }).replace(/[^a-z0-9\s]/gi, " ");
  const compact = normalizeWhitespace(normalized);
  const grams = [];
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.push(compact.slice(index, index + size));
  }
  return grams;
}

function topVocabulary(words, count) {
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([word]) => word);
}

function punctuationProfile(text) {
  const chars = [...text];
  const punctuation = [",", ".", ";", ":", "!", "?", "-", "(", ")", "\"", "'", "’"];
  const counts = new Map(punctuation.map((mark) => [mark, 0]));
  for (const char of chars) {
    if (counts.has(char)) counts.set(char, counts.get(char) + 1);
  }
  const denominator = Math.max(chars.length, 1);
  return punctuation.map((mark) => (counts.get(mark) / denominator) * 1000);
}

function wordLengthDistribution(words) {
  const buckets = Array(16).fill(0);
  for (const word of words) {
    const length = Math.min(word.length, 15);
    buckets[length] += 1;
  }
  return buckets.slice(1);
}

function sentenceLengthDistribution(sentences, options) {
  const buckets = Array(8).fill(0);
  for (const sentence of sentences) {
    const length = tokenizeWords(sentence, options).length;
    const bucket = length >= 50 ? 7 : Math.floor(length / 7);
    buckets[Math.max(0, Math.min(bucket, 7))] += 1;
  }
  return buckets;
}

export function profileText(text, options = {}) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const prepared = prepareText(text, merged);
  const words = tokenizeWords(prepared, merged);
  const sentences = splitSentences(prepared, merged);
  const uniqueWords = new Set(words);
  const wordCounts = new Map();
  for (const word of words) wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  const hapaxCount = [...wordCounts.values()].filter((count) => count === 1).length;
  const sentenceLengths = sentences.map((sentence) => tokenizeWords(sentence, merged).length).filter(Boolean);
  const charCount = [...prepared].length;
  const aiMarkerHits = AI_MARKERS.reduce((count, marker) => {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return count + (prepared.match(new RegExp(`\\b${escaped}\\b`, "g")) || []).length;
  }, 0);

  return {
    text: prepared,
    wordCount: words.length,
    charCount,
    sentenceCount: sentences.length,
    avgWordLength: words.length ? mean(words.map((word) => word.length)) : 0,
    avgSentenceLength: mean(sentenceLengths),
    sentenceLengthStd: stddev(sentenceLengths),
    ttr: words.length ? uniqueWords.size / words.length : 0,
    hapaxRatio: words.length ? hapaxCount / words.length : 0,
    punctuationVector: punctuationProfile(prepared),
    wordLengthVector: wordLengthDistribution(words),
    sentenceLengthVector: sentenceLengthDistribution(sentences, merged),
    words,
    aiMarkerRate: words.length ? (aiMarkerHits / words.length) * 1000 : 0
  };
}

function methodWeights(sensitivity) {
  if (sensitivity === "strict") {
    return { functionWords: 0.3, charNgrams: 0.25, wordLength: 0.14, punctuation: 0.14, sentenceRhythm: 0.11, lexical: 0.06 };
  }
  if (sensitivity === "lenient") {
    return { functionWords: 0.25, charNgrams: 0.2, wordLength: 0.16, punctuation: 0.12, sentenceRhythm: 0.12, lexical: 0.15 };
  }
  return { functionWords: 0.28, charNgrams: 0.23, wordLength: 0.15, punctuation: 0.13, sentenceRhythm: 0.12, lexical: 0.09 };
}

function topDifferences(labels, a, b, limit = 8) {
  return labels
    .map((label, index) => ({ label, a: a[index] || 0, b: b[index] || 0, diff: Math.abs((a[index] || 0) - (b[index] || 0)) }))
    .sort((left, right) => right.diff - left.diff)
    .slice(0, limit)
    .map((item) => ({ ...item, a: round(item.a), b: round(item.b), diff: round(item.diff) }));
}

export function compareTexts(textA, textB, options = {}) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const profileA = profileText(textA, merged);
  const profileB = profileText(textB, merged);
  const combinedWords = profileA.words.concat(profileB.words);
  const mfwVocabulary = topVocabulary(
    combinedWords.filter((word) => FUNCTION_WORDS.includes(word)),
    Math.max(20, Number(merged.mfwCount) || DEFAULT_OPTIONS.mfwCount)
  );
  const functionVocabulary = mfwVocabulary.length >= 20 ? mfwVocabulary : FUNCTION_WORDS.slice(0, Number(merged.mfwCount) || 80);
  const functionA = frequencyVector(profileA.words, functionVocabulary, 1000);
  const functionB = frequencyVector(profileB.words, functionVocabulary, 1000);

  const gramsA = buildNgrams(profileA.text, Number(merged.ngramSize) || 3);
  const gramsB = buildNgrams(profileB.text, Number(merged.ngramSize) || 3);
  const gramVocabulary = topVocabulary(gramsA.concat(gramsB), 180);
  const gramA = frequencyVector(gramsA, gramVocabulary, 1000);
  const gramB = frequencyVector(gramsB, gramVocabulary, 1000);

  const lexicalA = [profileA.ttr * 100, profileA.hapaxRatio * 100, profileA.avgWordLength, profileA.avgSentenceLength];
  const lexicalB = [profileB.ttr * 100, profileB.hapaxRatio * 100, profileB.avgWordLength, profileB.avgSentenceLength];
  const lexicalSimilarities = lexicalA.map((value, index) => relativeDifferenceSimilarity(value, lexicalB[index], 0.7));

  const methods = {
    functionWords: cosineSimilarity(functionA, functionB),
    charNgrams: cosineSimilarity(gramA, gramB),
    wordLength: distributionSimilarity(profileA.wordLengthVector, profileB.wordLengthVector),
    punctuation: cosineSimilarity(profileA.punctuationVector, profileB.punctuationVector),
    sentenceRhythm: distributionSimilarity(profileA.sentenceLengthVector, profileB.sentenceLengthVector),
    lexical: mean(lexicalSimilarities)
  };

  const weights = methodWeights(merged.sensitivity);
  const score = Object.entries(weights).reduce((sum, [method, weight]) => sum + methods[method] * weight, 0);
  const confidence = Math.min(profileA.wordCount, profileB.wordCount) < 300 ? "low" : Math.min(profileA.wordCount, profileB.wordCount) < 900 ? "medium" : "higher";
  const threshold = merged.sensitivity === "strict" ? 0.82 : merged.sensitivity === "lenient" ? 0.68 : 0.75;

  return {
    score: round(score, 4),
    sameAuthorProbability: Math.round(score * 100),
    threshold,
    verdict: score >= threshold ? "likely-same" : score >= threshold - 0.1 ? "borderline" : "likely-different",
    confidence,
    methods: Object.fromEntries(Object.entries(methods).map(([key, value]) => [key, round(value, 4)])),
    weights,
    profiles: [summarizeProfile(profileA), summarizeProfile(profileB)],
    diagnostics: {
      functionWordDifferences: topDifferences(functionVocabulary, functionA, functionB),
      wordLengthA: profileA.wordLengthVector,
      wordLengthB: profileB.wordLengthVector,
      sentenceLengthA: profileA.sentenceLengthVector,
      sentenceLengthB: profileB.sentenceLengthVector,
      punctuationDifferences: topDifferences([",", ".", ";", ":", "!", "?", "-", "(", ")", "\"", "'", "’"], profileA.punctuationVector, profileB.punctuationVector)
    }
  };
}

function summarizeProfile(profile) {
  return {
    wordCount: profile.wordCount,
    sentenceCount: profile.sentenceCount,
    charCount: profile.charCount,
    avgWordLength: round(profile.avgWordLength, 2),
    avgSentenceLength: round(profile.avgSentenceLength, 2),
    sentenceLengthStd: round(profile.sentenceLengthStd, 2),
    ttr: round(profile.ttr, 3),
    hapaxRatio: round(profile.hapaxRatio, 3),
    aiMarkerRate: round(profile.aiMarkerRate, 3)
  };
}

function chunkWords(words, chunkSize = 550) {
  const chunks = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    const chunk = words.slice(index, index + chunkSize);
    if (chunk.length >= Math.min(180, chunkSize)) chunks.push(chunk.join(" "));
  }
  return chunks;
}

export function referenceStyleAudit(candidateText, referenceText, options = {}) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const candidateProfile = profileText(candidateText, merged);
  const referenceProfile = profileText(referenceText, merged);
  const referenceChunks = chunkWords(referenceProfile.words, Number(merged.referenceChunkSize) || 550);

  if (referenceChunks.length < 2 || candidateProfile.wordCount < 120) {
    return {
      available: false,
      reason: "Add at least two medium reference passages and a candidate of roughly 120+ words for a meaningful reference audit."
    };
  }

  const candidateScores = referenceChunks.map((chunk) => compareTexts(candidateText, chunk, merged).score);
  const baselineScores = [];
  for (let left = 0; left < referenceChunks.length; left += 1) {
    for (let right = left + 1; right < referenceChunks.length; right += 1) {
      baselineScores.push(compareTexts(referenceChunks[left], referenceChunks[right], merged).score);
    }
  }

  const candidateMean = mean(candidateScores);
  const baselineMean = mean(baselineScores);
  const baselineSpread = stddev(baselineScores);
  const distance = baselineMean - candidateMean;
  const profile = summarizeProfile(candidateProfile);
  const reference = summarizeProfile(referenceProfile);
  const burstinessRatio = reference.sentenceLengthStd ? profile.sentenceLengthStd / reference.sentenceLengthStd : 1;
  const markerDelta = profile.aiMarkerRate - reference.aiMarkerRate;
  const atypicality = clamp((distance + Math.max(0, markerDelta / 20) + Math.max(0, 0.75 - burstinessRatio) * 0.12) / 0.45);

  let verdict = "consistent";
  if (atypicality > 0.66) verdict = "atypical";
  else if (atypicality > 0.42) verdict = "mixed";

  return {
    available: true,
    verdict,
    atypicality: round(atypicality, 4),
    candidateToReference: round(candidateMean, 4),
    referenceBaseline: round(baselineMean, 4),
    referenceSpread: round(baselineSpread, 4),
    referenceChunks: referenceChunks.length,
    burstinessRatio: round(burstinessRatio, 3),
    markerDelta: round(markerDelta, 3),
    note: "This is a reference-style mismatch check, not a standalone AI detector.",
    profile,
    reference
  };
}

export { DEFAULT_OPTIONS, FUNCTION_WORDS };
