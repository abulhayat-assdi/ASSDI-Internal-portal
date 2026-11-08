"use client";
import { useEffect, useState } from "react";
import FormCompetitionStudent from "./FormCompetitionStudent";
import IncubationApp from "@/components/incubation/IncubationApp";
import FieldTrackingCard from "@/components/tracking/FieldTrackingCard";
const isRunning = (c: { isActive?: boolean; startDate?: string; endDate?: string | null }) => {
  const now = Date.now();
  return (
    !!c.isActive &&
    (!c.startDate || Date.parse(c.startDate) <= now) &&
    (!c.endDate || now <= Date.parse(c.endDate))
  );
};
export default function StudentCompetitionEntry({ id }: { id: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/student/competitions/" + id)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Competition লোড হচ্ছে…</p>;
  if (data.incubation) return <IncubationApp student competitionId={id} />;
  return (
    <>
      {data.tracking?.enabled && (
        <div className="max-w-5xl mx-auto mb-5">
          <FieldTrackingCard
            competitionId={id}
            title={data.competition.title}
            running={isRunning(data.competition)}
            tracking={data.tracking}
          />
        </div>
      )}
      <FormCompetitionStudent />
    </>
  );
}
