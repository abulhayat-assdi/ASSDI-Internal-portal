-- CreateTable
CREATE TABLE "competition_products" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_procurements" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "member_roll" TEXT NOT NULL,
    "member_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "procured_on" TEXT NOT NULL,
    "note" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_procurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_products_competition_id_idx" ON "competition_products"("competition_id");

-- CreateIndex
CREATE INDEX "competition_products_course_id_idx" ON "competition_products"("course_id");

-- CreateIndex
CREATE INDEX "competition_procurements_competition_id_idx" ON "competition_procurements"("competition_id");

-- CreateIndex
CREATE INDEX "competition_procurements_course_id_idx" ON "competition_procurements"("course_id");

-- CreateIndex
CREATE INDEX "competition_procurements_product_id_idx" ON "competition_procurements"("product_id");

-- AddForeignKey
ALTER TABLE "competition_products" ADD CONSTRAINT "competition_products_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_products" ADD CONSTRAINT "competition_products_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_procurements" ADD CONSTRAINT "competition_procurements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_procurements" ADD CONSTRAINT "competition_procurements_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_procurements" ADD CONSTRAINT "competition_procurements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "competition_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-Level Security: same course-isolation pattern as every other
-- tenant-scoped table (see 20260912171615_enable_row_level_security).
ALTER TABLE "competition_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_products" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competition_products"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );

ALTER TABLE "competition_procurements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_procurements" FORCE ROW LEVEL SECURITY;
CREATE POLICY course_isolation ON "competition_procurements"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  )
  WITH CHECK (
    current_setting('app.is_super_admin', true) = 'true'
    OR course_id = current_setting('app.current_course_id', true)
  );
