import assert from "node:assert/strict";
import { compareTexts, referenceStyleAudit, tokenizeWords } from "../analysis-core.mjs";

const sampleA = `
The committee reviewed the proposal with care, because the risks were practical rather than theoretical.
I suggested that we keep the language plain and make each assumption visible before drawing a conclusion.
The draft was revised again after the meeting, and the final note explained why the smaller plan was safer.
`.repeat(8);

const sampleB = `
The board studied the plan carefully, because the problem was practical rather than abstract.
I recommended that we keep the argument plain and show each assumption before reaching a conclusion.
The memo was updated after the meeting, and the final paragraph explained why the smaller option was safer.
`.repeat(8);

const sampleC = `
Sunlight scattered across the harbor while the train climbed inland and the children counted bridges from the window.
Nobody cared about the old timetable, because the day had already turned into a loose collection of songs and errands.
At dusk the market closed, the rain arrived, and the story drifted toward a stranger ending than anyone expected.
`.repeat(8);

const aiLike = `
Overall, it is important to note that this solution provides a robust and seamless approach.
Furthermore, it leverages nuanced insights to underscore the crucial role of effective communication.
In conclusion, the approach not only improves clarity but also creates a comprehensive framework for future success.
`.repeat(8);

assert.equal(tokenizeWords("Hello, world's end.").length, 3);

const close = compareTexts(sampleA, sampleB);
const far = compareTexts(sampleA, sampleC);
assert.ok(close.score > far.score, `expected similar samples to score higher: ${close.score} vs ${far.score}`);
assert.ok(close.profiles[0].wordCount > 300);
assert.ok(close.diagnostics.functionWordDifferences.length > 0);

const audit = referenceStyleAudit(aiLike, sampleA + sampleB);
assert.equal(audit.available, true);
assert.ok(audit.atypicality >= 0);

console.log("analysis-core tests passed");
