import { Fragment, type ReactNode } from "react";

type Props = {
  text: string;
  className?: string;
};

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={index}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={index}>{token.slice(1, -1)}</em>);
    }
    index += 1;
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

function heading(line: string) {
  if (line.startsWith("### ")) {
    return <h3>{inline(line.slice(4))}</h3>;
  }
  if (line.startsWith("## ")) {
    return <h2>{inline(line.slice(3))}</h2>;
  }
  if (line.startsWith("# ")) {
    return <h1>{inline(line.slice(2))}</h1>;
  }
  return null;
}

function listItem(line: string) {
  const unordered = line.match(/^[-*] (.+)$/);
  if (unordered?.[1]) {
    return { ordered: false, text: unordered[1] };
  }
  const ordered = line.match(/^\d+\. (.+)$/);
  if (ordered?.[1]) {
    return { ordered: true, text: ordered[1] };
  }
  return null;
}

export function Markdown({ text, className = "" }: Props) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push(<p key={key}>{inline(paragraph.join(" "))}</p>);
    key += 1;
    paragraph = [];
  };

  const flushList = () => {
    if (!list) {
      return;
    }
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={key}>
        {list.items.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    key += 1;
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const title = heading(trimmed);
    if (title) {
      flushParagraph();
      flushList();
      blocks.push(<Fragment key={key}>{title}</Fragment>);
      key += 1;
      continue;
    }
    const item = listItem(trimmed);
    if (item) {
      flushParagraph();
      if (!list || list.ordered !== item.ordered) {
        flushList();
        list = { ordered: item.ordered, items: [] };
      }
      list.items.push(item.text);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();

  return <div className={`md ${className}`.trim()}>{blocks}</div>;
}
