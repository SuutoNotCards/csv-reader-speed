// A faster drop-in for csv-reader 1.0.0's readCsv: the same answer {columns, rows, errors} for every input {text, header}.
// One pass over char codes, fields cut with slice, no per-field objects.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = n > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  for (;;) {
    // Lines with no characters (LF or CRLF only) are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else break;
    }
    if (pos >= n) break;

    const recLine = line;
    const recRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let more = true; // the last field ended at a comma

    while (more) {
      let value = '';
      let junkCheck = false;
      quoted = pos < n && text.charCodeAt(pos) === 34;

      if (quoted) {
        const open = pos;
        const openLine = line;
        let p = pos + 1;
        let s = p;
        let closed = false;
        while (p < n) {
          const c = text.charCodeAt(p);
          if (c === 34) {
            if (p + 1 < n && text.charCodeAt(p + 1) === 34) {
              value += text.slice(s, p + 1);
              p += 2;
              s = p;
              continue;
            }
            value += text.slice(s, p);
            p++;
            closed = true;
            break;
          }
          if (c === 13) {
            value += text.slice(s, p) + '\n';
            line++;
            p += p + 1 < n && text.charCodeAt(p + 1) === 10 ? 2 : 1;
            s = p;
            continue;
          }
          if (c === 10) line++;
          p++;
        }
        if (!closed) {
          // The quote is a literal character and the text after it is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recLine, row: recRow });
          value = '"';
        } else {
          pos = p;
          if (p >= n) {
            fields.push(value);
            more = false;
            continue;
          }
          const c = text.charCodeAt(p);
          if (c === 44) {
            pos = p + 1;
            fields.push(value);
            continue;
          }
          if (c === 10) {
            pos = p + 1;
            line++;
            fields.push(value);
            more = false;
            continue;
          }
          if (c === 13 && p + 1 < n && text.charCodeAt(p + 1) === 10) {
            pos = p + 2;
            line++;
            fields.push(value);
            more = false;
            continue;
          }
          junkCheck = true; // what follows the closing quote is appended as it stands
        }
      }

      // Unquoted characters onto value up to the next comma or line break; a CR not followed by LF is dropped.
      let s = pos;
      let added = false;
      more = false;
      while (pos < n) {
        const c = text.charCodeAt(pos);
        if (c === 44) {
          more = true;
          break;
        }
        if (c === 10) break;
        if (c === 13) {
          if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) break;
          if (pos > s) {
            value += text.slice(s, pos);
            added = true;
          }
          errors.push({ code: 'stray_cr', line: recLine, row: recRow });
          pos++;
          s = pos;
          continue;
        }
        pos++;
      }
      if (pos > s) {
        value = value === '' ? text.slice(s, pos) : value + text.slice(s, pos);
        added = true;
      }
      if (pos < n) {
        const c = text.charCodeAt(pos);
        if (c === 44) pos++;
        else if (c === 10) {
          pos++;
          line++;
        } else {
          pos += 2; // CRLF
          line++;
        }
      }
      if (junkCheck && added) errors.push({ code: 'quote_junk', line: recLine, row: recRow });
      fields.push(value);
    }

    // A line that held only stray CRs is no record (its stray_cr errors stay).
    if (fields.length === 1 && !quoted && fields[0] === '') continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    const len = fields.length;
    if (len < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: len });
      for (let i = len; i < width; i++) fields.push('');
    } else if (len > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

// Warm-up at import: one small text through every branch (BOM, CRLF, stray CR, "" , quote junk, unterminated quote,
// short and long rows), so the optimized code has seen each path. Nothing is kept from it.
{
  const t = '﻿a,b,c\r\n"x""y",z\rq,"m\r\nn"\n\r\n"p"j,k\n1,2\n1,2,3,4\n\n"u\nv",w\r"o,"';
  for (let i = 0; i < 3; i++) {
    run({ text: t, header: true });
    run({ text: t, header: false });
  }
}
