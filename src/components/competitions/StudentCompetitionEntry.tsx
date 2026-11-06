"use client";
import { useEffect, useState } from "react";
import FormCompetitionStudent from "./FormCompetitionStudent";
import IncubationApp from "@/components/incubation/IncubationApp";
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
  return data.incubation ? (
    <IncubationApp student competitionId={id} />
  ) : (
    <FormCompetitionStudent />
  );
}
