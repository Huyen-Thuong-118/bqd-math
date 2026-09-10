import katex from "katex";

type Token = { value: string; display: boolean; math: boolean };

const MATH_TOKEN = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$(?:\\.|[^$\\\n])+?\$|\\\([\s\S]+?\\\))/g;

function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of content.matchAll(MATH_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ value: content.slice(cursor, index), display: false, math: false });
    }
    const raw = match[0];
    const display = raw.startsWith("$$") || raw.startsWith("\\[");
    const value = raw.startsWith("$$")
      ? raw.slice(2, -2)
      : raw.startsWith("$")
        ? raw.slice(1, -1)
        : raw.slice(2, -2);
    tokens.push({ value, display, math: true });
    cursor = index + raw.length;
  }
  if (cursor < content.length) {
    tokens.push({ value: content.slice(cursor), display: false, math: false });
  }
  return tokens;
}

function MathNode({ latex, display }: { latex: string; display: boolean }) {
  const html = katex.renderToString(latex, {
    displayMode: display,
    throwOnError: false,
    strict: "warn",
    trust: false,
    output: "htmlAndMathml",
  });
  return display ? (
    <span className="my-2 block max-w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className="inline-block max-w-full align-middle" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function MathText({
  children,
  className,
  mathOnly = false,
}: {
  children: string;
  className?: string;
  mathOnly?: boolean;
}) {
  if (mathOnly && children.trim()) {
    return (
      <span className={className}>
        <MathNode latex={children.trim().replace(/^\$\$?|\$\$?$/g, "")} display={false} />
      </span>
    );
  }
  return (
    <span className={className}>
      {tokenize(children).map((token, index) =>
        token.math ? (
          <MathNode key={index} latex={token.value} display={token.display} />
        ) : (
          <span key={index} className="whitespace-pre-wrap">{token.value}</span>
        ),
      )}
    </span>
  );
}

