import PublicIncubationReport from "@/components/incubation/PublicIncubationReport";
export const metadata={title:"Business Incubation Report",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <PublicIncubationReport token={token}/>;}
