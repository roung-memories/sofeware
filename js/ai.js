/* ============================================
   Client-side Anthropic API + Markdown renderer
   ============================================ */

// ── Topics (mirrors Python ai_service.py) ──

const AI_TOPICS = [
  'personal growth, self-improvement, and lifelong learning',
  'emotional awareness, mindfulness, and managing stress and anxiety',
  'building resilience, overcoming setbacks, and developing a growth mindset',
  'the power of habits, daily routines, and small consistent actions',
  'self-compassion, self-acceptance, and inner peace',
  'finding meaning and purpose in everyday life',
  'the art of letting go: dealing with change and uncertainty',
  'gratitude, optimism, and the science of happiness',
  'authenticity, setting boundaries, and building healthy relationships',
  'rest, reflection, and the value of slowing down in a fast-paced world',
];

const AI_SYSTEM_PROMPT = `You are a Chinese language teacher creating high-quality reading material for an adult learner at the intermediate level (HSK 4-5, approximately B1 CEFR). The content focuses on personal growth, emotional well-being, and spiritual healing.

RULES:
- Write 1000-1500 Chinese characters (approximately 7 minutes of reading aloud).
- Use warm, natural, contemporary written Chinese. Avoid 成语-heavy or classical style.
- Content should be practical, relatable, and gently inspiring — like a thoughtful friend sharing insights.
- Include proper nouns with English glosses in parentheses on first mention.
- Output in the exact structured format below.
- Do NOT include pinyin annotations inline -- pinyin goes in the vocabulary table only.

OUTPUT FORMAT (markdown):

## <Title in Chinese>

<Passage body in paragraphs of Chinese text. Use **bold** for key terms.>

## Key Vocabulary
| Chinese | Pinyin | English |
|---------|--------|---------|
| ...     | ...    | ...     |

(8-12 entries, sorted by appearance order)

## Comprehension Questions
1. <Question in Chinese>
   **Answer:** <Answer in Chinese>

(3-4 questions)`;

// ── Anthropic API call ──

async function callAnthropicAPI(apiKey) {
  const topic = AI_TOPICS[Math.floor(Math.random() * AI_TOPICS.length)];
  const today = new Date().toISOString().split('T')[0];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: AI_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Generate today's Chinese reading passage on the theme: ${topic}. Today's date: ${today}.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json();
  const rawMd = data.content[0].text;

  // Extract title (first ## line)
  const titleLine = rawMd.split('\n')[0].replace(/^#+\s*/, '').trim();

  // Count Chinese characters
  const chineseChars = [...rawMd].filter(
    (c) => c >= '一' && c <= '鿿'
  ).length;

  // Render HTML
  const contentHtml = renderMarkdown(rawMd);

  return {
    title: titleLine,
    content_md: rawMd,
    content_html: contentHtml,
    word_count: chineseChars,
    estimated_minutes: Math.round((chineseChars / 180) * 10) / 10,
  };
}

// ── Lightweight Markdown → HTML renderer ──

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(md) {
  const lines = md.split('\n');
  const html = [];
  let inTable = false;
  let tableRows = [];
  let inCodeBlock = false;
  let codeBlockContent = [];
  let inParagraph = false;

  function flushParagraph() {
    if (inParagraph) {
      html.push('</p>');
      inParagraph = false;
    }
  }

  function startParagraph() {
    if (!inParagraph) {
      html.push('<p>');
      inParagraph = true;
    }
  }

  function renderInline(text) {
    // Escape HTML, then handle **bold** and `inline code`
    let escaped = escapeHtml(text);
    // **bold** → <strong>
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // `inline code` → <code>
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    return escaped;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html.push('<pre><code>' + codeBlockContent.join('\n') + '</code></pre>\n');
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(escapeHtml(line));
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      if (inTable) {
        // End table
        html.push(renderTable(tableRows));
        tableRows = [];
        inTable = false;
      }
      flushParagraph();
      continue;
    }

    // Table row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      // Skip separator row (e.g., |---|---|)
      if (cells.length > 0 && cells[0].includes('-')) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(cells);
      continue;
    }

    // Heading (must be at start of line)
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);
    if (h2Match) {
      flushParagraph();
      html.push('<h2>' + renderInline(h2Match[1]) + '</h2>\n');
      continue;
    }
    if (h3Match) {
      flushParagraph();
      html.push('<h3>' + renderInline(h3Match[1]) + '</h3>\n');
      continue;
    }

    // Regular text → paragraph
    startParagraph();
    html.push(renderInline(line));
  }

  // Flush remaining
  if (inCodeBlock) {
    html.push('<pre><code>' + codeBlockContent.join('\n') + '</code></pre>\n');
  }
  if (inTable) {
    html.push(renderTable(tableRows));
  }
  flushParagraph();

  return html.join('');
}

function renderTable(rows) {
  if (rows.length === 0) return '';
  let h = '<table>\n<thead>\n<tr>\n';
  for (const cell of rows[0]) {
    h += '<th>' + escapeHtml(cell) + '</th>\n';
  }
  h += '</tr>\n</thead>\n<tbody>\n';
  for (let r = 1; r < rows.length; r++) {
    h += '<tr>\n';
    for (const cell of rows[r]) {
      h += '<td>' + escapeHtml(cell) + '</td>\n';
    }
    h += '</tr>\n';
  }
  h += '</tbody>\n</table>\n';
  return h;
}
