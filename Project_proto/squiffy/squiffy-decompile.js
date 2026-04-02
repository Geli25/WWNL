#!/usr/bin/env node
'use strict';

/**
 * squiffy-decompile.js
 * Converts a compiled Squiffy 5.x story.js back to .squiffy source format.
 * Usage: node squiffy-decompile.js
 * Output: story.squiffy in the same directory as this script.
 *
 * _continueN sections (compiler artifacts from +++ links) are handled as:
 *   - The first _continue from a named section → inlined with +++ syntax
 *   - Deeper _continue sections → output as [[continue_N]]: (renamed)
 */

const fs   = require('fs');
const path = require('path');

// ─── 1. Load story.js and extract squiffy.story data ───────────────────────

const storyPath = path.join(__dirname, '..', 'story.js');
const storyJs   = fs.readFileSync(storyPath, 'utf8');

const squiffy = { story: {}, myVar: null };

const dataStart = storyJs.indexOf("squiffy.story.start = '");
if (dataStart === -1) throw new Error('Cannot find squiffy.story.start in story.js');
const dataEnd = storyJs.lastIndexOf('})();');
if (dataEnd === -1)   throw new Error('Cannot find IIFE closing })(); in story.js');

// eslint-disable-next-line no-eval
eval(storyJs.slice(dataStart, dataEnd));

const START    = squiffy.story.start;
const SECTIONS = squiffy.story.sections;

if (!SECTIONS) throw new Error('squiffy.story.sections was not set after eval');
if (!SECTIONS[START]) console.warn(`Warning: @start section "${START}" not found`);

// ─── 2. _continue helpers ───────────────────────────────────────────────────

const CONTINUE_RE = /^_continue\d+$/;

/** _continueN → continue_N */
function renameContinue(name) {
  return name.replace(/^_continue(\d+)$/, 'continue_$1');
}

// ─── 3. HTML → Squiffy markup converter ────────────────────────────────────

function htmlToSquiffy(html) {
  if (!html) return '';

  // Protect iframes
  const iframes = [];
  html = html.replace(/<iframe[\s\S]*?<\/iframe>/gi, (m) => {
    iframes.push(m);
    return `\x00IFRAME${iframes.length - 1}\x00`;
  });

  // Section links — rename any _continueN targets that weren't extracted
  html = html.replace(
    /<a[^>]+class="squiffy-link link-section"[^>]+data-section="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, section, display) => {
      display = stripTags(display).trim();
      section = section.trim();
      if (CONTINUE_RE.test(section)) section = renameContinue(section);
      return display === section ? `[[${section}]]` : `[[${display}]](${section})`;
    }
  );

  // Passage links
  html = html.replace(
    /<a[^>]+class="squiffy-link link-passage"[^>]+data-passage="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, passage, display) => {
      display = stripTags(display).trim();
      passage = passage.trim();
      return display === passage ? `[${passage}]` : `[${display}](${passage})`;
    }
  );

  html = html.replace(/<b>([\s\S]*?)<\/b>/gi,          '**$1**');
  html = html.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  html = html.replace(/<i>([\s\S]*?)<\/i>/gi,           '*$1*');
  html = html.replace(/<em>([\s\S]*?)<\/em>/gi,         '*$1*');
  html = html.replace(/<h1>([\s\S]*?)<\/h1>/gi, '# $1\n');
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/gi, '## $1\n');
  html = html.replace(/<h3>([\s\S]*?)<\/h3>/gi, '### $1\n');
  html = html.replace(/<h4>([\s\S]*?)<\/h4>/gi, '#### $1\n');
  html = html.replace(/<h5>([\s\S]*?)<\/h5>/gi, '##### $1\n');
  html = html.replace(/<h6>([\s\S]*?)<\/h6>/gi, '###### $1\n');
  html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```');

  html = html.replace(/<ul>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    inner = inner.replace(/<p>([\s\S]*?)<\/p>/gi, '$1');
    return inner.replace(/<li>([\s\S]*?)<\/li>/gi, (__, item) => `- ${item.trim()}\n`);
  });

  html = html.replace(/<p>/gi,       '');
  html = html.replace(/<\/p>/gi,     '\n\n');
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<[^>]+>/g,    '');

  html = html
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&amp;/g,  '&');

  iframes.forEach((iframe, i) => {
    html = html.replace(`\x00IFRAME${i}\x00`, iframe);
  });

  return html.replace(/\n{3,}/g, '\n\n').trim();
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

// ─── 4. Attribute converter ─────────────────────────────────────────────────

function convertAttr(attr) {
  if (!attr || typeof attr !== 'string') return '// EMPTY ATTR';

  if (attr.startsWith('@')) {
    return attr.replace(/<p>([\s\S]*?)<\/p>$/, (_, inner) =>
      htmlToSquiffy(`<p>${inner}</p>`)
    ).trimEnd();
  }

  const incMatch = attr.match(/^(\w+)\s*\+=\s*(\d+)$/);
  if (incMatch) {
    const n = parseInt(incMatch[2], 10);
    return n === 1
      ? `@inc ${incMatch[1]}`
      : Array.from({ length: n }, () => `@inc ${incMatch[1]}`).join('\n');
  }

  const decMatch = attr.match(/^(\w+)\s*-=\s*(\d+)$/);
  if (decMatch) {
    const n = parseInt(decMatch[2], 10);
    return n === 1
      ? `@dec ${decMatch[1]}`
      : Array.from({ length: n }, () => `@dec ${decMatch[1]}`).join('\n');
  }

  const setMatch = attr.match(/^(\w+)=(.+)$/);
  if (setMatch) return `@set ${setMatch[1]} = ${setMatch[2]}`;

  if (/^\w+$/.test(attr)) return `@set ${attr} = true`;

  return `// UNKNOWN ATTR: ${attr}`;
}

// ─── 5. JS function body extractor ─────────────────────────────────────────

function extractJsBody(fn) {
  const src       = fn.toString();
  const bodyStart = src.indexOf('{') + 1;
  const bodyEnd   = src.lastIndexOf('}');
  const body      = src.slice(bodyStart, bodyEnd);

  const rawLines = body.split('\n');
  const nonEmpty = rawLines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return '';

  const minIndent = nonEmpty.reduce((min, l) => {
    const m = l.match(/^(\s+)/);
    return Math.min(min, m ? m[1].length : 0);
  }, Infinity);

  return rawLines
    .map(l => minIndent === Infinity ? l : l.slice(minIndent))
    .join('\n')
    .trim();
}

// ─── 6. Continue link extractor ─────────────────────────────────────────────

/**
 * Find the last <p> wrapping a single link to a _continueN section.
 * Returns the HTML before that paragraph, the continue target name,
 * and the display text.
 */
function extractContinueLink(html) {
  const matches = [
    ...html.matchAll(
      /<p>\s*<a[^>]+class="squiffy-link link-section"[^>]+data-section="(_continue\d+)"[^>]*>([\s\S]*?)<\/a>\s*<\/p>/gi
    )
  ];
  if (matches.length === 0) {
    return { beforeHtml: html, continueTarget: null, continueDisplay: null };
  }
  const last = matches[matches.length - 1];
  return {
    beforeHtml:      html.slice(0, last.index),
    continueTarget:  last[1],
    continueDisplay: stripTags(last[2]).trim(),
  };
}

// ─── 7. Pre-processing: classify _continue chains ──────────────────────────

// Each _continueN chain is a simple linked list. Walking from the root
// (the _continue linked by a named section) and alternating inline/standalone
// classifies every node in one pass — no fixed-point loop needed.
//   named → _continueA (inline) → _continueB (standalone) → _continueC (inline) → …

const inlinedContinues = new Set();

for (const [name] of Object.entries(SECTIONS)) {
  if (CONTINUE_RE.test(name)) continue;
  let { continueTarget } = extractContinueLink(SECTIONS[name].text || '');
  let inline = true;
  while (continueTarget && CONTINUE_RE.test(continueTarget)) {
    if (inline) inlinedContinues.add(continueTarget);
    const sec = SECTIONS[continueTarget];
    continueTarget = sec ? extractContinueLink(sec.text || '').continueTarget : null;
    inline = !inline;
  }
}

// ─── 8. Section body writer ─────────────────────────────────────────────────

function writePassage(pName, passage, lines) {
  lines.push('');
  lines.push(`[${pName}]:`);
  if (passage.clear) lines.push('@clear');
  if (Array.isArray(passage.attributes) && passage.attributes.length > 0) {
    for (const attr of passage.attributes) lines.push(convertAttr(attr));
  }
  const pText = htmlToSquiffy(passage.text || '');
  if (pText) { lines.push(''); lines.push(pText); }
  if (typeof passage.js === 'function') {
    lines.push('');
    lines.push('@javascript');
    lines.push(extractJsBody(passage.js));
  }
}

function emitSectionLink(lines, target, display) {
  const targetName = CONTINUE_RE.test(target) ? renameContinue(target) : target;
  const text = display || '...';
  lines.push('');
  lines.push(text === targetName ? `[[${targetName}]]` : `[[${text}]](${targetName})`);
}

function writePassages(section, lines) {
  if (section.passages && typeof section.passages === 'object') {
    for (const [pName, passage] of Object.entries(section.passages)) {
      if (passage) writePassage(pName, passage, lines);
    }
  }
}

/**
 * Write a section's text, JS, passages, and continue/forward link.
 * isTopLevel=false: inside an inlined block — continue link comes before
 *   passages so it sits directly below the text the player just read.
 */
function writeSectionBody(section, lines, isTopLevel) {
  const { beforeHtml, continueTarget, continueDisplay } =
    extractContinueLink(section.text || '');

  const text = htmlToSquiffy(beforeHtml);
  if (text) { lines.push(''); lines.push(text); }

  if (typeof section.js === 'function') {
    lines.push('');
    lines.push('@javascript');
    lines.push(extractJsBody(section.js));
  }

  if (!isTopLevel) {
    if (continueTarget) emitSectionLink(lines, continueTarget, continueDisplay);
    writePassages(section, lines);
    return;
  }

  writePassages(section, lines);

  if (!continueTarget) return;

  if (inlinedContinues.has(continueTarget)) {
    lines.push('');
    lines.push(`+++ ${continueDisplay}`);
    const cont = SECTIONS[continueTarget];
    if (cont) {
      if (Array.isArray(cont.attributes) && cont.attributes.length > 0) {
        for (const attr of cont.attributes) lines.push(convertAttr(attr));
      }
      writeSectionBody(cont, lines, false);
    }
  } else {
    emitSectionLink(lines, continueTarget, continueDisplay);
  }
}

// ─── 9. Build .squiffy output ───────────────────────────────────────────────

const lines = [];
lines.push('@title When We Are No Longer');
lines.push(`@start ${START}`);
lines.push('');

for (const [sectionName, section] of Object.entries(SECTIONS)) {
  // Skip _continue sections that are inlined into their parent
  if (inlinedContinues.has(sectionName)) continue;

  // Rename remaining _continue sections (e.g. _continue3 → continue_3)
  const outputName = CONTINUE_RE.test(sectionName)
    ? renameContinue(sectionName)
    : sectionName;

  lines.push(`[[${outputName}]]:`);

  if (section.clear) lines.push('@clear');

  if (Array.isArray(section.attributes) && section.attributes.length > 0) {
    for (const attr of section.attributes) lines.push(convertAttr(attr));
  }

  writeSectionBody(section, lines, true);

  lines.push('');
}

// ─── 10. Write output ───────────────────────────────────────────────────────

const outputPath = path.join(__dirname, 'story.squiffy');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

const total    = Object.keys(SECTIONS).length;
const inlined  = inlinedContinues.size;
const written  = total - inlined;
console.log(`Done. ${written} sections written (${inlined} _continue sections inlined with +++)`);
