-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "address" TEXT,
ADD COLUMN "expectedClosureDate" TIMESTAMP(3),
ADD COLUMN "solutionAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "oemNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "presalesIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
