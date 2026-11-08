import LiveTrackingMap from "@/components/tracking/LiveTrackingMap";

export const metadata = { title: "Live map" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveTrackingMap competitionId={id} />;
}
