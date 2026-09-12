-- CreateTable: hero_images
CREATE TABLE "hero_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hero_images_order_idx" ON "hero_images"("order");
CREATE INDEX "hero_images_is_active_idx" ON "hero_images"("is_active");

-- Seed existing hero images from public/images/home/
INSERT INTO "hero_images" ("id", "url", "storage_path", "label", "order", "is_active", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), '/images/home/hero-slide-1.jpg', 'images/home/hero-slide-1.jpg', 'Hero Slide 1', 0, true, NOW(), NOW()),
    (gen_random_uuid(), '/images/home/hero-slide-2.jpg', 'images/home/hero-slide-2.jpg', 'Hero Slide 2', 1, true, NOW(), NOW()),
    (gen_random_uuid(), '/images/home/audience-bg.JPG', 'images/home/audience-bg.JPG', 'Audience Background', 2, true, NOW(), NOW());
