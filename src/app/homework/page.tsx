import HomeworkUpload from "@/components/students/HomeworkUpload";
import { Metadata } from "next";
import { getRequestBranding } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getRequestBranding();
  return {
    title: `Submit Homework | ${brand.name}`,
    description: "Upload and submit your homework assignments easily.",
  };
}

export default function HomeworkPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-emerald-600 font-bold uppercase tracking-wider text-sm">Student Portal</span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-4 mb-4">Homework Submission</h1>
          <p className="text-slate-600 max-w-xl mx-auto">
            Please fill in your details and upload your assignment files. 
            Supported formats: PDF, Word, Excel, PPT, Images, and ZIP.
          </p>
        </div>

        <HomeworkUpload />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-2">Check File Size</h3>
            <p className="text-sm text-slate-500">Maximum file size allowed is 100MB. For larger files, please compress them.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-2">Correct Details</h3>
            <p className="text-sm text-slate-500">Ensure your Student ID is correct so we can identify your submission.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-2">Need Help?</h3>
            <p className="text-sm text-slate-500">If you face any issues during upload, please contact your instructor.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
