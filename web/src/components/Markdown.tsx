import { Fragment, type ReactNode } from "react";

// A small, safe markdown renderer: headings, lists, checklists, bold, code and paragraphs.
// It builds React elements directly, so document text can never inject HTML.
// `cite` turns [1] style markers into whatever the caller wants (Tams uses source chips).

type Cite = (n: number, key: string) => ReactNode;

function inline(text: string, cite: Cite | undefined, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+(?:\s*,\s*\d+)*\])/g;
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyBase}-${i++}`;
    if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (cite) {
      token
        .slice(1, -1)
        .split(",")
        .forEach((n, j) => out.push(<Fragment key={`${key}-${j}`}>{cite(Number(n.trim()), `${key}-${j}`)}</Fragment>));
    } else out.push(token);
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, cite }: { text: string; cite?: Cite }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      const k = `p${key++}`;
      blocks.push(
        <p key={k}>
          {paragraph.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(line, cite, `${k}-${i}`)}
            </Fragment>
          ))}
        </p>,
      );
    }
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const k = `l${key++}`;
      const items = list.items.map((item, i) => {
        const task = /^\[( |x)\] /i.exec(item);
        return task ? (
          <li key={i} className="task">
            <input type="checkbox" disabled checked={task[1].toLowerCase() === "x"} /> {inline(item.slice(4), cite, `${k}-${i}`)}
          </li>
        ) : (
          <li key={i}>{inline(item, cite, `${k}-${i}`)}</li>
        );
      });
      blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4}) (.+)$/.exec(line);
    const bullet = /^\s*[-*] (.+)$/.exec(line);
    const numbered = /^\s*\d+[.)] (.+)$/.exec(line);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const k = `h${key++}`;
      const content = inline(heading[2], cite, k);
      blocks.push(heading[1].length === 1 ? <h1 key={k}>{content}</h1> : heading[1].length === 2 ? <h2 key={k}>{content}</h2> : <h3 key={k}>{content}</h3>);
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div className="prose">{blocks}</div>;
}
