import IncubationApp from '@/components/incubation/IncubationApp';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <IncubationApp competitionId={id}/>}
