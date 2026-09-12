-- CreateTable
CREATE TABLE "cv_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "thumbnail" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'My CV',
    "full_name" TEXT,
    "profile_photo" TEXT,
    "career_objective" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "date_of_birth" TEXT,
    "blood_group" TEXT,
    "religion" TEXT,
    "marital_status" TEXT,
    "nationality" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "languages" JSONB NOT NULL DEFAULT '[]',
    "hobbies" JSONB NOT NULL DEFAULT '[]',
    "work_experience" JSONB NOT NULL DEFAULT '[]',
    "training" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "references" JSONB NOT NULL DEFAULT '[]',
    "declaration" TEXT,
    "signature" TEXT,
    "section_order" JSONB NOT NULL DEFAULT '["workExperience","training","education","languages","references","skills","hobbies"]',
    "share_slug" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_versions" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cv_templates_slug_key" ON "cv_templates"("slug");

-- CreateIndex
CREATE INDEX "cv_templates_is_active_idx" ON "cv_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cv_drafts_share_slug_key" ON "cv_drafts"("share_slug");

-- CreateIndex
CREATE INDEX "cv_drafts_user_id_idx" ON "cv_drafts"("user_id");

-- CreateIndex
CREATE INDEX "cv_drafts_template_id_idx" ON "cv_drafts"("template_id");

-- CreateIndex
CREATE INDEX "cv_drafts_share_slug_idx" ON "cv_drafts"("share_slug");

-- CreateIndex
CREATE INDEX "cv_drafts_created_at_idx" ON "cv_drafts"("created_at");

-- CreateIndex
CREATE INDEX "cv_versions_draft_id_idx" ON "cv_versions"("draft_id");

-- CreateIndex
CREATE INDEX "cv_versions_created_at_idx" ON "cv_versions"("created_at");

-- AddForeignKey
ALTER TABLE "cv_drafts" ADD CONSTRAINT "cv_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_drafts" ADD CONSTRAINT "cv_drafts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "cv_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "cv_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
