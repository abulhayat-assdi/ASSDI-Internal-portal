import ModuleOutlineView from "@/components/course-modules/ModuleOutlineView";

type Props = {
  params: Promise<{ slug: string }>;
};

export const metadata = { title: "Course Module | Internal Portal" };

export default async function TeacherModuleOutlinePage({ params }: Props) {
  const { slug } = await params;
  return <ModuleOutlineView slug={slug} onlyPublished={false} fullHeightClass="min-h-[calc(100vh-4rem)]" />;
}
