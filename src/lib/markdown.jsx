// Tiny markdown renderer for admin-editable prose blocks. Supports the
// minimum set non-technical editors actually need: paragraphs, line breaks,
// **bold**, *italic*, and [links](url). Returns React nodes (not HTML
// strings) so we never have to reach for dangerouslySetInnerHTML.
//
// If we ever need headings, lists, or code spans, swap the body for `marked`
// (single dep, ~20KB) — call sites stay the same.
//
// Security: link URLs are whitelisted to http/https/mailto/tel. Bare text is
// rendered as-is by React, which escapes for us — no HTML injection vector.

import { Fragment } from 'react';

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/)/i;

function safeUrl(href) {
  return SAFE_URL.test(href) ? href : '#';
}

// Inline tokens: link → bold → italic. Order matters — links contain text
// that could otherwise match bold/italic, so we extract links first.
function renderInline(text, keyPrefix = 'inl') {
  const out = [];
  let buf = '';
  let key = 0;
  const flushBuf = () => {
    if (buf) { out.push(buf); buf = ''; }
  };
  const pushNode = (node) => { out.push(<Fragment key={`${keyPrefix}-${key++}`}>{node}</Fragment>); };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // [text](url)
    if (ch === '[') {
      const close = text.indexOf('](', i + 1);
      if (close !== -1) {
        const urlEnd = text.indexOf(')', close + 2);
        if (urlEnd !== -1) {
          const label = text.slice(i + 1, close);
          const url = text.slice(close + 2, urlEnd);
          flushBuf();
          pushNode(<a href={safeUrl(url)} target="_blank" rel="noopener noreferrer">{label}</a>);
          i = urlEnd + 1;
          continue;
        }
      }
    }

    // **bold**
    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        const inner = text.slice(i + 2, end);
        flushBuf();
        pushNode(<strong>{inner}</strong>);
        i = end + 2;
        continue;
      }
    }

    // *italic*
    if (ch === '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1) {
        const inner = text.slice(i + 1, end);
        flushBuf();
        pushNode(<em>{inner}</em>);
        i = end + 1;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flushBuf();
  return out;
}

// Parses paragraph-level structure. Returns an array of <p> elements; a
// single `\n` inside a paragraph becomes a <br>.
export function renderMarkdown(text) {
  if (text == null) return null;
  const str = String(text);
  if (!str.trim()) return null;

  const paragraphs = str.replace(/\r\n/g, '\n').split(/\n{2,}/);

  return paragraphs.map((p, pi) => {
    const lines = p.split('\n');
    const nodes = [];
    lines.forEach((line, li) => {
      nodes.push(<Fragment key={`l-${li}`}>{renderInline(line, `p${pi}-l${li}`)}</Fragment>);
      if (li < lines.length - 1) nodes.push(<br key={`br-${li}`} />);
    });
    return <p key={`p-${pi}`}>{nodes}</p>;
  });
}

// Inline-only variant (no <p> wrappers) — for places like the chairman
// quote where the surrounding component already provides paragraph styling.
export function renderInlineMarkdown(text) {
  if (text == null) return null;
  const str = String(text);
  if (!str.trim()) return null;
  return renderInline(str.replace(/\r\n/g, '\n'));
}
