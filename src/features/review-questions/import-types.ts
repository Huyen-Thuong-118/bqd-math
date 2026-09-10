export type ImportedReviewQuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER";

export type ImportedQuestionFigure = {
  objectKey: string;
  url: string;
  alt: string;
};

export type ImportedReviewQuestion = {
  id: string;
  number: string;
  type: ImportedReviewQuestionType;
  content: string;
  options: string[];
  correctAnswer: string;
  textSolution: string;
  confidence: number;
  warnings: string[];
  snapshotUrls: string[];
  questionFigures: ImportedQuestionFigure[];
  solutionFigures: ImportedQuestionFigure[];
};

export type ReviewQuestionImportResult = {
  documentId: string;
  filename: string;
  pageCount: number;
  warnings: string[];
  questions: ImportedReviewQuestion[];
};
