ALTER TABLE "ReviewQuestion"
ADD COLUMN "questionImageKeys" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "solutionImageKeys" JSONB NOT NULL DEFAULT '[]';

