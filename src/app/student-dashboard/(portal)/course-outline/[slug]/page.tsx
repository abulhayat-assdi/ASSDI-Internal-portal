import ModuleOutlineView from "@/components/course-modules/ModuleOutlineView";

type Props = {
  params: Promise<{ slug: string }>;
};

export const metadata = { title: "Course Module | Student Portal" };

export default async function StudentModuleOutlinePage({ params }: Props) {
  const { slug } = await params;
  return (
    <ModuleOutlineView
      slug={slug}
      onlyPublished
      fullHeightClass="min-h-[calc(100dvh-12rem)] lg:min-h-[calc(100dvh-7rem)]"
    />
  );
}
