import { notFound } from "next/navigation";
import { getModuleData } from "@/data/modules";
import { Metadata } from 'next';
import CurriculumTimeline from "@/components/course-modules/CurriculumTimeline";
import BackButton from "@/components/ui/BackButton";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const data = getModuleData(resolvedParams.slug);
  if (!data) return { title: 'Module Not Found' };
  return {
    title: `${data.title} | Student Portal`,
  };
}

export default async function StudentModuleOutlinePage({ params }: Props) {
  const resolvedParams = await params;
  const courseData = getModuleData(resolvedParams.slug);

  if (!courseData) {
    notFound();
  }

  return (
             <div className="bg-[#f1f3f5] min-h-[calc(100vh-4rem)] rounded-2xl relative overflow-hidden border border-gray-200" style={{ backgroundImage: "linear-gradient(#e9ecef 1px, transparent 1px), linear-gradient(90deg, #e9ecef 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
               <div className="w-full px-6 lg:px-8 pt-6">
                 <BackButton />
               </div>
               <div className="w-full py-10 px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
                 <span className="inline-block py-1 px-3 rounded-full bg-white shadow-sm border border-gray-200 text-gray-500 text-xs font-bold tracking-widest uppercase mb-3">
                   Course Curriculum Guide
                 </span>
                 <h1 className="text-2xl md:text-3xl lg:text-4xl font-black mb-3 tracking-tight text-gray-800 drop-shadow-sm uppercase">
                   {courseData.title}
                 </h1>
                 <p className="text-sm md:text-base text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
                   {courseData.description}
                 </p>
               </div>
       
               <div className="pb-12 px-2 md:px-6">
                 <CurriculumTimeline data={courseData} />
               </div>
             </div>
  );
}
