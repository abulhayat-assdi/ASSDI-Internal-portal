import Entry from '@/components/competitions/StudentCompetitionEntry';
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <Entry id={id}/>;}
