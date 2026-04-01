#!/usr/bin/env node
'use strict';

/**
 * squiffy-decompile.js
 * Converts a compiled Squiffy 5.x story.js back to .squiffy source format.
 * Usage: node squiffy-decompile.js
 * Output: story.squiffy in the same directory as this script.
 */

const fs   = require('fs');
const path = require('path');

// ─── 1. Load story.js and extract squiffy.story data ───────────────────────

const storyPath = path.join(__dirname, '..', 'story.js');
const storyJs   = fs.readFileSync(storyPath, 'utf8');

// Create a squiffy mock that captures the data assignments.
// js-functions inside sections are defined but never called here,
// so we only need enough stubs to avoid parse/eval errors.
const squiffy = { story: {}, myVar: null };
/* eslint-disable no-unused-vars */
const _setTimeout   = global.setTimeout;
const _clearTimeout = global.clearTimeout;
/* eslint-enable no-unused-vars */

// Extract only the data block: squiffy.story.start = '...' through the sections assignment.
// We stop just before the IIFE closing `})();`.
const dataStart = storyJs.indexOf("squiffy.story.start = '");
if (dataStart === -1) throw new Error('Cannot find squiffy.story.start in story.js');
const dataEnd = storyJs.lastIndexOf('})();');
if (dataEnd === -1)   throw new Error('Cannot find IIFE closing })(); in story.js');

// eslint-disable-next-line no-eval
eval(storyJs.slice(dataStart, dataEnd));

const START    = squiffy.story.start;
const SECTIONS = squiffy.story.sections;

if (!SECTIONS) throw new Error('squiffy.story.sections was not set after eval');
if (!SECTIONS[START]) {
  console.warn(`Warning: @start section "${START}" was not found in sections`);
}

// ─── 2. HTML → Squiffy markup converter ────────────────────────────────────

function htmlToSquiffy(html) {
  if (!html) return '';

  // 2a. Protect iframes with numbered placeholders so nothing inside is touched.
  const iframes = [];
  html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, (m) => {
    iframes.push(m);
    return `\x00IFRAME${iframes.length - 1}\x00`;
  });

  // 2b. Convert squiffy section links.
  //   Compiled: <a class="squiffy-link link-section" data-section="NAME" ...>DISPLAY</a>
  //   Source:   [[NAME]]  or  [[DISPLAY:NAME]]
  html = html.replace(
    /<a[^>]+class="squiffy-link link-section"[^>]+data-section="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, section, display) => {
      display = stripTags(display).trim();
      section = section.trim();
      return display === section ? `[[${section}]]` : `[[${display}:${section}]]`;
    }
  );

  // 2c. Convert squiffy passage links.
  //   Compiled: <a class="squiffy-link link-passage" data-passage="NAME" ...>DISPLAY</a>
  //   Source:   [NAME]  or  [DISPLAY:NAME]
  html = html.replace(
    /<a[^>]+class="squiffy-link link-passage"[^>]+data-passage="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, passage, display) => {
      display = stripTags(display).trim();
      passage = passage.trim();
      return display === passage ? `[${passage}]` : `[${display}:${passage}]`;
    }
  );

  // 2d. Bold / italic
  html = html.replace(/<b>([\s\S]*?)<\/b>/gi,           '**$1**');
  html = html.replace(/<strong>([\s\S]*?)<\/strong>/gi,  '**$1**');
  html = html.replace(/<i>([\s\S]*?)<\/i>/gi,            '*$1*');
  html = html.replace(/<em>([\s\S]*?)<\/em>/gi,          '*$1*');

  // 2e. Headings h1–h6
  html = html.replace(/<h1>([\s\S]*?)<\/h1>/gi, '# $1\n');
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/gi, '## $1\n');
  html = html.replace(/<h3>([\s\S]*?)<\/h3>/gi, '### $1\n');
  html = html.replace(/<h4>([\s\S]*?)<\/h4>/gi, '#### $1\n');
  html = html.replace(/<h5>([\s\S]*?)<\/h5>/gi, '##### $1\n');
  html = html.replace(/<h6>([\s\S]*?)<\/h6>/gi, '###### $1\n');

  // 2f. Fenced code blocks
  html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```');

  // 2g. Unordered lists (handle before paragraph stripping)
  html = html.replace(/<ul>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    // Strip any <p>...</p> wrappers inside list items first
    inner = inner.replace(/<p>([\s\S]*?)<\/p>/gi, '$1');
    return inner.replace(/<li>([\s\S]*?)<\/li>/gi, (__, item) => `- ${item.trim()}\n`);
  });

  // 2h. Paragraphs – strip opening tag, convert closing tag to double newline
  html = html.replace(/<p>/gi, '');
  html = html.replace(/<\/p>/gi, '\n\n');

  // 2i. Line breaks
  html = html.replace(/<br\s*\/?>/gi, '\n');

  // 2j. Strip any remaining HTML tags that weren't handled above
  html = html.replace(/<[^>]+>/g, '');

  // 2k. Decode HTML entities.
  //   Decode specific entities first; &amp; goes last to prevent double-decoding
  //   (e.g. &amp;lt; → &lt; → '<' would be wrong; decode &lt; first → no match,
  //   then &amp; → & giving &lt; which is correct).
  html = html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&amp;/g,  '&');   // &amp; decoded last

  // 2l. Restore iframes
  iframes.forEach((iframe, i) => {
    html = html.replace(`\x00IFRAME${i}\x00`, iframe);
  });

  // 2m. Collapse 3+ consecutive blank lines to 2, then trim edges
  html = html.replace(/\n{3,}/g, '\n\n').trim();

  return html;
}

/** Strip HTML tags from a string (used to extract plain display text). */
function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

// ─── 3. Attribute converter ─────────────────────────────────────────────────

/**
 * Convert a compiled attribute string to a .squiffy source directive.
 *
 * Compiled format  →  Source directive
 *   "variable=0"                      →  @set variable = 0
 *   "variable+=1"                     →  @inc variable
 *   "variable-=1"                     →  @dec variable
 *   "flag"  (plain boolean)           →  @set flag = true
 *   "@replace 2=<p>G.D.O Tower</p>"  →  @replace 2=G.D.O Tower
 *   "@replace 1=<p><a ...>...</a></p>"→  @replace 1=[[display:section]]
 */
function convertAttr(attr) {
  if (!attr || typeof attr !== 'string') return `// EMPTY ATTR`;

  // @-directives: @replace, @clear, etc. — pass through but strip any
  // wrapping <p>…</p> from the value portion and convert embedded links.
  if (attr.startsWith('@')) {
    return attr.replace(/<p>([\s\S]*?)<\/p>$/, (_, inner) => {
      return htmlToSquiffy(`<p>${inner}</p>`);
    }).trimEnd();
  }

  // Increment:  "var+=N"  (N must be a positive integer)
  const incMatch = attr.match(/^(\w+)\s*\+=\s*(\d+)$/);
  if (incMatch) {
    const n = parseInt(incMatch[2], 10);
    if (n === 1) return `@inc ${incMatch[1]}`;
    return Array.from({ length: n }, () => `@inc ${incMatch[1]}`).join('\n');
  }

  // Decrement:  "var-=N"
  const decMatch = attr.match(/^(\w+)\s*-=\s*(\d+)$/);
  if (decMatch) {
    const n = parseInt(decMatch[2], 10);
    if (n === 1) return `@dec ${decMatch[1]}`;
    return Array.from({ length: n }, () => `@dec ${decMatch[1]}`).join('\n');
  }

  // Assignment: "var=value"
  const setMatch = attr.match(/^(\w+)=(.+)$/);
  if (setMatch) {
    return `@set ${setMatch[1]} = ${setMatch[2]}`;
  }

  // Plain boolean flag: "flagname"
  if (/^\w+$/.test(attr)) {
    return `@set ${attr} = true`;
  }

  // Fallback — emit a comment so nothing is silently lost
  return `// UNKNOWN ATTR: ${attr}`;
}

// ─── 4. JS function body extractor ─────────────────────────────────────────

/**
 * Extract and de-indent the body of a function.
 * fn.toString() preserves the original source (in V8/Node.js), so we strip
 * the common leading whitespace of all non-empty lines.
 */
function extractJsBody(fn) {
  const src       = fn.toString();
  const bodyStart = src.indexOf('{') + 1;
  const bodyEnd   = src.lastIndexOf('}');
  const body      = src.slice(bodyStart, bodyEnd);

  const rawLines = body.split('\n');

  // Find minimum indentation among non-empty lines
  const nonEmpty = rawLines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return '';

  const minIndent = nonEmpty.reduce((min, l) => {
    const m = l.match(/^(\s+)/);
    return Math.min(min, m ? m[1].length : 0);
  }, Infinity);

  return rawLines
    .map(l => (minIndent === Infinity ? l : l.slice(minIndent)))
    .join('\n')
    .trim();
}

// ─── 5. Build .squiffy output ───────────────────────────────────────────────

const lines = [];

lines.push('@title When We Are No Longer');
lines.push(`@start ${START}`);
lines.push('');

for (const [sectionName, section] of Object.entries(SECTIONS)) {
  // Section header
  lines.push(`[[${sectionName}]]:`);

  // @clear directive (clears output before section renders)
  if (section.clear) {
    lines.push('@clear');
  }

  // Attributes (set/inc/dec/@replace)
  if (Array.isArray(section.attributes) && section.attributes.length > 0) {
    for (const attr of section.attributes) {
      lines.push(convertAttr(attr));
    }
  }

  // Section text
  const text = htmlToSquiffy(section.text || '');
  if (text) {
    lines.push('');
    lines.push(text);
  }

  // Inline JavaScript
  if (typeof section.js === 'function') {
    lines.push('');
    lines.push('@javascript');
    lines.push(extractJsBody(section.js));
  }

  // Passages
  if (section.passages && typeof section.passages === 'object') {
    for (const [passageName, passage] of Object.entries(section.passages)) {
      if (!passage) continue;

      lines.push('');
      lines.push(`[${passageName}]:`);

      if (passage.clear) {
        lines.push('@clear');
      }

      if (Array.isArray(passage.attributes) && passage.attributes.length > 0) {
        for (const attr of passage.attributes) {
          lines.push(convertAttr(attr));
        }
      }

      const pText = htmlToSquiffy(passage.text || '');
      if (pText) {
        lines.push('');
        lines.push(pText);
      }

      if (typeof passage.js === 'function') {
        lines.push('');
        lines.push('@javascript');
        lines.push(extractJsBody(passage.js));
      }
    }
  }

  lines.push('');
}

// ─── 6. Write output ────────────────────────────────────────────────────────

const outputPath = path.join(__dirname, 'story.squiffy');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

const sectionCount = Object.keys(SECTIONS).length;
console.log(`Done. Wrote ${sectionCount} sections to ${outputPath}`);
