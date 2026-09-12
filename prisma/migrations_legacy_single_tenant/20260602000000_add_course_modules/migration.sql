-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pdf_link" TEXT NOT NULL DEFAULT '',
    "bullets" JSONB NOT NULL DEFAULT '[]',
    "curriculum" JSONB NOT NULL DEFAULT '[]',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_modules_slug_key" ON "course_modules"("slug");

-- CreateIndex
CREATE INDEX "course_modules_slug_idx" ON "course_modules"("slug");

-- CreateIndex
CREATE INDEX "course_modules_order_idx" ON "course_modules"("order");
