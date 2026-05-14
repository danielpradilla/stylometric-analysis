import { compareTexts, referenceStyleAudit, tokenizeWords } from "./analysis-core.mjs";

const state = {
  result: null,
  audit: null
};

const $ = (selector) => document.querySelector(selector);

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function verdictLabel(verdict) {
  return {
    "likely-same": "Likely same author",
    "borderline": "Borderline",
    "likely-different": "Likely different authors",
    "consistent": "Consistent with reference",
    "mixed": "Mixed reference signal",
    "atypical": "Atypical vs reference"
  }[verdict] || verdict;
}

function getOptions() {
  return {
    caseSensitive: $("#caseSensitive").checked,
    ignoreQuotes: $("#ignoreQuotes").checked,
    mfwCount: Number($("#mfwCount").value),
    ngramSize: Number($("#ngramSize").value),
    sensitivity: $("#sensitivity").value,
    referenceChunkSize: Number($("#referenceChunkSize").value)
  };
}

async function readFileInput(input) {
  const file = input.files?.[0];
  if (!file) return "";
  return file.text();
}

function setTextMetrics() {
  const options = getOptions();
  const inputs = [
    ["#textA", "#countA"],
    ["#textB", "#countB"],
    ["#referenceText", "#countReference"]
  ];
  for (const [textSelector, countSelector] of inputs) {
    const words = tokenizeWords($(textSelector).value, options).length;
    $(countSelector).textContent = `${words.toLocaleString()} words`;
  }
}

function drawBarChart(canvas, labels, seriesA, seriesB, options = {}) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  const padding = { left: 34, right: 12, top: 16, bottom: 32 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...seriesA, ...seriesB, 1);

  ctx.strokeStyle = "rgba(28, 45, 74, 0.14)";
  ctx.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = padding.top + plotHeight - (plotHeight * tick) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const groupWidth = plotWidth / labels.length;
  const barWidth = Math.max(3, groupWidth * 0.32);
  labels.forEach((label, index) => {
    const x = padding.left + groupWidth * index + groupWidth * 0.18;
    const aHeight = (seriesA[index] / maxValue) * plotHeight;
    const bHeight = (seriesB[index] / maxValue) * plotHeight;
    ctx.fillStyle = "#1c4d8f";
    ctx.fillRect(x, padding.top + plotHeight - aHeight, barWidth, aHeight);
    ctx.fillStyle = "#e46f2b";
    ctx.fillRect(x + barWidth + 2, padding.top + plotHeight - bHeight, barWidth, bHeight);

    if (index % (options.labelEvery || 1) === 0) {
      ctx.fillStyle = "#5d6b7c";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x + barWidth, height - 10);
    }
  });
}

function drawRadar(canvas, methods) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  const labels = [
    ["Function", methods.functionWords],
    ["N-grams", methods.charNgrams],
    ["Length", methods.wordLength],
    ["Punct.", methods.punctuation],
    ["Rhythm", methods.sentenceRhythm],
    ["Lexical", methods.lexical]
  ];
  const centerX = width / 2;
  const centerY = height / 2 + 4;
  const radius = Math.min(width, height) * 0.34;

  ctx.strokeStyle = "rgba(28, 45, 74, 0.16)";
  ctx.fillStyle = "#5d6b7c";
  ctx.font = "10px system-ui, sans-serif";
  labels.forEach(([label], index) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.textAlign = x < centerX - 5 ? "right" : x > centerX + 5 ? "left" : "center";
    ctx.fillText(label, centerX + Math.cos(angle) * (radius + 16), centerY + Math.sin(angle) * (radius + 16));
  });

  ctx.beginPath();
  labels.forEach(([, value], index) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(43, 130, 122, 0.22)";
  ctx.strokeStyle = "#2b827a";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function renderResult() {
  const { result, audit } = state;
  const output = $("#output");
  if (!result) {
    output.hidden = true;
    return;
  }
  output.hidden = false;
  $("#scoreValue").textContent = `${result.sameAuthorProbability}%`;
  $("#verdict").textContent = verdictLabel(result.verdict);
  $("#confidence").textContent = `${result.confidence} confidence`;
  $("#threshold").textContent = `Decision threshold ${Math.round(result.threshold * 100)}%`;
  $("#scoreBar").style.width = `${result.sameAuthorProbability}%`;
  $("#summary").textContent = summaryText(result);

  const methodList = $("#methodList");
  methodList.innerHTML = "";
  for (const [key, value] of Object.entries(result.methods)) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${methodName(key)}</span><strong>${formatPercent(value)}</strong>`;
    methodList.appendChild(item);
  }

  $("#metricsBody").innerHTML = result.profiles.map((profile, index) => `
    <tr>
      <th scope="row">Text ${index === 0 ? "A" : "B"}</th>
      <td>${profile.wordCount.toLocaleString()}</td>
      <td>${profile.sentenceCount.toLocaleString()}</td>
      <td>${profile.avgWordLength}</td>
      <td>${profile.avgSentenceLength}</td>
      <td>${profile.ttr}</td>
      <td>${profile.hapaxRatio}</td>
    </tr>
  `).join("");

  $("#functionDiffs").innerHTML = result.diagnostics.functionWordDifferences.map((item) => `
    <tr><td>${item.label}</td><td>${item.a}</td><td>${item.b}</td><td>${item.diff}</td></tr>
  `).join("");
  $("#punctuationDiffs").innerHTML = result.diagnostics.punctuationDifferences.map((item) => `
    <tr><td>${item.label}</td><td>${item.a}</td><td>${item.b}</td><td>${item.diff}</td></tr>
  `).join("");

  drawBarChart($("#wordLengthChart"), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15+"], result.diagnostics.wordLengthA, result.diagnostics.wordLengthB, { labelEvery: 2 });
  drawBarChart($("#sentenceChart"), ["0-6", "7-13", "14-20", "21-27", "28-34", "35-41", "42-49", "50+"], result.diagnostics.sentenceLengthA, result.diagnostics.sentenceLengthB);
  drawRadar($("#methodRadar"), result.methods);

  renderAudit(audit);
}

function renderAudit(audit) {
  const panel = $("#referencePanel");
  if (!audit) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  if (!audit.available) {
    panel.innerHTML = `<h3>Reference Style Audit</h3><p class="muted">${audit.reason}</p>`;
    return;
  }
  panel.innerHTML = `
    <h3>Reference Style Audit</h3>
    <div class="audit-grid">
      <div><span class="kicker">Verdict</span><strong>${verdictLabel(audit.verdict)}</strong></div>
      <div><span class="kicker">Candidate vs reference</span><strong>${formatPercent(audit.candidateToReference)}</strong></div>
      <div><span class="kicker">Reference baseline</span><strong>${formatPercent(audit.referenceBaseline)}</strong></div>
      <div><span class="kicker">Atypicality</span><strong>${formatPercent(audit.atypicality)}</strong></div>
    </div>
    <p class="muted">${audit.note} It compares Text B to the supplied known writing and checks whether it falls outside the person's normal variation across ${audit.referenceChunks} reference chunks.</p>
    <p>Sentence burstiness ratio: <strong>${audit.burstinessRatio}</strong>. AI-marker rate delta: <strong>${audit.markerDelta}</strong> per 1,000 words.</p>
  `;
}

function methodName(key) {
  return {
    functionWords: "Function words",
    charNgrams: "Character n-grams",
    wordLength: "Word-length curve",
    punctuation: "Punctuation habits",
    sentenceRhythm: "Sentence rhythm",
    lexical: "Lexical richness"
  }[key] || key;
}

function summaryText(result) {
  const profileA = result.profiles[0];
  const profileB = result.profiles[1];
  const minimum = Math.min(profileA.wordCount, profileB.wordCount);
  const warning = minimum < 300 ? " The shorter sample is small; treat the result as exploratory." : "";
  const methodEntries = Object.entries(result.methods).sort((a, b) => b[1] - a[1]);
  const strongest = methodName(methodEntries[0][0]).toLowerCase();
  const weakest = methodName(methodEntries[methodEntries.length - 1][0]).toLowerCase();
  return `${verdictLabel(result.verdict)} at ${result.sameAuthorProbability}% similarity. Strongest agreement: ${strongest}. Largest divergence: ${weakest}.${warning}`;
}

async function analyze() {
  const options = getOptions();
  const pastedA = $("#textA").value.trim();
  const pastedB = $("#textB").value.trim();
  const fileA = await readFileInput($("#fileA"));
  const fileB = await readFileInput($("#fileB"));
  const textA = fileA || pastedA;
  const textB = fileB || pastedB;
  const referenceFile = await readFileInput($("#referenceFile"));
  const reference = referenceFile || $("#referenceText").value.trim();
  const error = $("#error");
  error.hidden = true;

  if (tokenizeWords(textA, options).length < 80 || tokenizeWords(textB, options).length < 80) {
    error.textContent = "Add at least 80 words to both Text A and Text B. Longer samples, ideally 500+ words, produce more stable stylometric signals.";
    error.hidden = false;
    return;
  }

  state.result = compareTexts(textA, textB, options);
  state.audit = reference ? referenceStyleAudit(textB, reference, options) : null;
  renderResult();
}

function clearAll() {
  for (const selector of ["#textA", "#textB", "#referenceText"]) $(selector).value = "";
  for (const selector of ["#fileA", "#fileB", "#referenceFile"]) $(selector).value = "";
  state.result = null;
  state.audit = null;
  $("#error").hidden = true;
  setTextMetrics();
  renderResult();
}

function loadExample() {
  $("#textA").value = `The practical difficulty is not in naming the problem, but in keeping the method honest while the evidence remains thin. A careful reader notices habits that survive changes of subject: the way a sentence turns, the little connecting words, the preference for plain verbs over ornament. Those habits are never absolute proof. They are traces, and traces must be weighed together.

When I compare documents I want the instrument to show its work. A single number is useful only if the route to that number is visible. Function words, punctuation, sentence length, and repeated character patterns each carry a small part of the signal. Agreement across several of them gives the conclusion more weight; disagreement asks for caution.`;
  $("#textB").value = `The useful question is not whether a text feels familiar, but whether several quiet measurements point in the same direction. Topic can mislead us because a person changes vocabulary when the subject changes. The smaller words are harder to stage. So are the rhythms of punctuation and the length of ordinary sentences.

For that reason, a good comparison should expose the evidence instead of hiding it behind a confident label. If the function words align but the punctuation does not, the result should say so. If both samples are short, the result should admit the weakness. The aim is not certainty; it is a disciplined way to decide how much trust the similarity deserves.`;
  $("#referenceText").value = `I prefer tools that keep their assumptions close to the surface. When a decision depends on measurement, the measurement should be inspectable. That is especially true for language, where a change of audience or deadline can make the same person sound unlike himself. Good software should show the signals, the caveats, and the places where the evidence runs out.

There is also a practical side. A user should be able to paste text, read a result, and understand the next step without consulting a manual. The advanced controls can exist, but they should not block the primary task. The interface has to be quiet enough for repeated use and explicit enough for disagreement.

The practical difficulty is not in naming the problem, but in keeping the method honest while the evidence remains thin. A careful reader notices habits that survive changes of subject: the way a sentence turns, the little connecting words, the preference for plain verbs over ornament. Those habits are never absolute proof. They are traces, and traces must be weighed together.

When I compare documents I want the instrument to show its work. A single number is useful only if the route to that number is visible. Function words, punctuation, sentence length, and repeated character patterns each carry a small part of the signal. Agreement across several of them gives the conclusion more weight; disagreement asks for caution.

The useful question is not whether a text feels familiar, but whether several quiet measurements point in the same direction. Topic can mislead us because a person changes vocabulary when the subject changes. The smaller words are harder to stage. So are the rhythms of punctuation and the length of ordinary sentences.

For that reason, a good comparison should expose the evidence instead of hiding it behind a confident label. If the function words align but the punctuation does not, the result should say so. If both samples are short, the result should admit the weakness. The aim is not certainty; it is a disciplined way to decide how much trust the similarity deserves.`;
  setTextMetrics();
}

function exportJson() {
  if (!state.result) return;
  const payload = JSON.stringify({ result: state.result, referenceAudit: state.audit, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stylometric-analysis.json";
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  $("#analyze").addEventListener("click", analyze);
  $("#clear").addEventListener("click", clearAll);
  $("#example").addEventListener("click", loadExample);
  $("#exportJson").addEventListener("click", exportJson);
  for (const selector of ["#textA", "#textB", "#referenceText", "#mfwCount", "#ngramSize", "#referenceChunkSize", "#caseSensitive", "#ignoreQuotes", "#sensitivity"]) {
    $(selector).addEventListener("input", setTextMetrics);
    $(selector).addEventListener("change", setTextMetrics);
  }
  for (const selector of ["#fileA", "#fileB", "#referenceFile"]) {
    $(selector).addEventListener("change", async (event) => {
      const text = await readFileInput(event.target);
      const map = { fileA: "#textA", fileB: "#textB", referenceFile: "#referenceText" };
      if (text) $(map[event.target.id]).value = text;
      setTextMetrics();
    });
  }
  window.addEventListener("resize", () => {
    if (state.result) renderResult();
  });
}

bindEvents();
setTextMetrics();
