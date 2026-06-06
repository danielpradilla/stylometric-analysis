# Stylometric Analysis

A browser-based stylometry tool for comparing two writing samples and auditing a candidate passage against known writing by the same person.

The app is designed for static hosting on `danielpradilla.info`. Uploaded files are read locally in the browser; no text is sent to a server.

## Features

- Paste two texts or upload two plain text files.
- Same-author similarity score with interpretable diagnostics.
- Optional reference-style audit for AI-assisted or ghostwritten mismatch checks.
- Method controls for sensitivity, most frequent words, character n-grams, quoted text, and reference chunking.
- Charts for method agreement, word-length curves, and sentence rhythm.
- Difference tables for function words and punctuation.
- Built-in user guide and a project style guide aligned with `/Users/dpradilla/dev/danielpradilla-app-style/GUIDE.md`.

## Methods

The comparison is inspired by standard stylometric approaches:

- Function-word usage, following the common stylometry focus on topic-light words.
- Word-length curves, related to Mendenhall-style characteristic curves.
- Character n-gram cosine similarity.
- Punctuation rate comparison.
- Sentence-length rhythm.
- Lexical richness checks.

The AI-style audit is deliberately conservative. It does not claim to detect AI text by itself. It compares Text B to known writing by the person and reports whether Text B is atypical relative to variation inside the reference material.

## Local Use

Open `index.html` directly in a browser, or run a static server:

```bash
python3 -m http.server 5173
```

Then visit `http://localhost:5173`.

## Tests

```bash
npm test
```

## Deployment

The production test deployment is intended for:

```text
https://danielpradilla.info/stylometric-analysis/
```

The initial deployment is protected with HTTP Basic Auth on DreamHost.
