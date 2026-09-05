import "server-only";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

type GeminiSection = {
  label: string;
  count: number;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
};

export type GeminiExamAnalysis = {
  sections: GeminiSection[];
  pageCount: number;
  answerKey: string[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
};

const responseSchema = {
  type: "object",
  properties: {
    pageCount: {
      type: "integer",
      description: "Số trang của file đề thi, không tính file lời giải.",
    },
    sections: {
      type: "array",
      description: "Các phần của đề theo đúng thứ tự xuất hiện.",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          count: { type: "integer" },
          type: {
            type: "string",
            enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"],
          },
        },
        required: ["label", "count", "type"],
      },
    },
    answerKey: {
      type: "array",
      description: "Đáp án được làm phẳng theo thứ tự các phần và số câu.",
      items: { type: "string" },
    },
  },
  required: ["pageCount", "sections", "answerKey"],
} as const;

function normalizeAnswer(answer: string, type: GeminiSection["type"]) {
  const value = answer.trim();
  if (type === "MULTIPLE_CHOICE") return value.toUpperCase();
  if (type === "TRUE_FALSE") {
    return value
      .toUpperCase()
      .replaceAll("Đ", "D")
      .split(/[;,|\s]+/)
      .filter(Boolean)
      .join(",");
  }
  return value;
}

function parseGeminiResult(raw: unknown): GeminiExamAnalysis {
  if (!raw || typeof raw !== "object") throw new Error("Gemini trả về JSON rỗng.");
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    throw new Error("Gemini không nhận diện được cấu trúc đề.");
  }

  const sections = value.sections.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Cấu trúc phần thi không hợp lệ.");
    const section = item as Record<string, unknown>;
    if (
      typeof section.label !== "string" ||
      !Number.isInteger(section.count) ||
      Number(section.count) <= 0 ||
      !["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"].includes(String(section.type))
    ) {
      throw new Error("Gemini trả về cấu trúc phần thi không hợp lệ.");
    }
    return {
      label: section.label.trim(),
      count: Number(section.count),
      type: section.type as GeminiSection["type"],
    };
  });

  const questionTypes = sections.flatMap((section) =>
    Array(section.count).fill(section.type) as GeminiSection["type"][],
  );
  if (questionTypes.length > 200) throw new Error("Gemini nhận diện quá 200 câu.");

  const rawAnswers = Array.isArray(value.answerKey)
    ? value.answerKey.filter((answer): answer is string => typeof answer === "string")
    : [];
  const answerKey = rawAnswers.map((answer, index) =>
    normalizeAnswer(answer, questionTypes[index] ?? "SHORT_ANSWER"),
  );

  return {
    sections,
    pageCount: Number.isInteger(value.pageCount) && Number(value.pageCount) > 0
      ? Number(value.pageCount)
      : 0,
    answerKey,
  };
}

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function analyzeExamPdfsWithGemini(
  examPdf: Buffer,
  answerPdf?: Buffer,
): Promise<GeminiExamAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");

  const model = (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL)
    .replace(/^models\//, "");
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("GEMINI_MODEL không hợp lệ.");

  const instruction = answerPdf
    ? `Đọc hai file PDF đính kèm. File thứ nhất là ĐỀ THI, file thứ hai là ĐÁP ÁN/LỜI GIẢI.
Nhận diện chính xác các phần và số câu từ ĐỀ THI. Với đề THPT Việt Nam, phân loại:
- câu chọn A/B/C/D: MULTIPLE_CHOICE;
- mỗi câu gồm 4 ý đúng/sai: TRUE_FALSE;
- câu cần nhập số/kết quả: SHORT_ANSWER.
Trích answerKey CHỈ từ file ĐÁP ÁN/LỜI GIẢI, theo đúng thứ tự câu của từng phần rồi nối các phần lại.
Mỗi đáp án trắc nghiệm là A, B, C hoặc D. Mỗi câu đúng/sai là một chuỗi đúng 4 giá trị D/S ngăn bởi dấu phẩy, ví dụ "D,S,D,S". Đáp án ngắn giữ nguyên dấu âm và dấu phẩy/chấm thập phân.
Không suy đoán từ nội dung đề. Nếu file lời giải không nêu đủ đáp án thì chỉ trả các đáp án đọc chắc chắn được.`
    : `Đọc file PDF ĐỀ THI đính kèm và nhận diện chính xác các phần cùng số câu.
Phân loại câu chọn A/B/C/D là MULTIPLE_CHOICE, câu có 4 ý đúng/sai là TRUE_FALSE, câu cần nhập số/kết quả là SHORT_ANSWER.
Không có file lời giải nên answerKey phải là mảng rỗng.`;

  const parts: Array<Record<string, unknown>> = [
    { text: instruction },
    { text: "FILE 1 — ĐỀ THI:" },
    { inlineData: { mimeType: "application/pdf", data: examPdf.toString("base64") } },
  ];
  if (answerPdf) {
    parts.push(
      { text: "FILE 2 — ĐÁP ÁN/LỜI GIẢI:" },
      { inlineData: { mimeType: "application/pdf", data: answerPdf.toString("base64") } },
    );
  }

  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema,
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini API trả lỗi HTTP ${response.status}.`);
  }
  const responseText = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!responseText) throw new Error("Gemini không trả về nội dung.");

  try {
    return parseGeminiResult(JSON.parse(responseText));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Gemini trả về JSON không hợp lệ.");
    throw error;
  }
}
