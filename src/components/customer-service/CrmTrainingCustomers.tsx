"use client";
import { useEffect, useState } from "react";
import { Search, UsersRound } from "lucide-react";

export type TrainingCustomer = {
  id: string;
  name: string;
  number: string;
  registeredNumber: string;
  trainingKey: string;
  trainingProfile: {
    reference: string;
    email: string;
    scenario: string;
    issueType: string;
    complaintType: string;
    transactionReference: string;
    transactionAmount: string;
  };
};

export default function CrmTrainingCustomers({
  workspaceId,
  onUse,
}: {
  workspaceId: string;
  onUse?: (customer: TrainingCustomer) => void;
}) {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    rows: TrainingCustomer[];
    total: number;
    starterComplaints: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      "/api/crm?" +
        new URLSearchParams({
          kind: "customers",
          workspaceId,
          page: String(page),
          search: applied,
        }),
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw Error(result.error || "Customers could not be loaded");
        return result;
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [workspaceId, applied, page]);
  return (
    <section className="crm-panel">
      <div className="crm-panel-title">
        <div>
          <h3>Training customer directory</h3>
          <p>
            Reference customers for new practice complaints in this workspace.
          </p>
        </div>
        <UsersRound size={20} />
      </div>
      <div className="p-5">
        <p className="text-sm text-slate-500 mb-4">
          Use either contact number with Fetch Data. Numbers beginning with 000
          are fictional and must not be dialled. {data?.starterComplaints || 0}{" "}
          starter customer complaints are already in All Complaints; the
          remaining profiles are listed here. Reports include saved complaints.
        </p>
        <form
          className="flex gap-3 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(search);
            setPage(1);
          }}
        >
          <input
            aria-label="Search training customers"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or either number"
          />
          <button disabled={loading}>
            <Search size={16} />
            Search
          </button>
        </form>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {loading && <p role="status">Loading training customers...</p>}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Calling number</th>
                    <th>Registered number</th>
                    <th>Practice scenario</th>
                    {onUse && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {data?.rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <div>{c.trainingProfile.reference}</div>
                      </td>
                      <td>{c.number}</td>
                      <td>{c.registeredNumber}</td>
                      <td className="crm-scenario-cell">
                        <strong>{c.trainingProfile.issueType}</strong>
                        <p>{c.trainingProfile.scenario}</p>
                      </td>
                      {onUse && (
                        <td>
                          <button onClick={() => onUse(c)}>Use customer</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data?.rows.length && (
              <p className="p-8 text-center text-slate-500">
                No training customers found. An administrator can load the
                training pack from Settings.
              </p>
            )}
            <div className="flex justify-between items-center gap-3 mt-5">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {page} · {data?.total || 0} training customers
              </span>
              <button
                disabled={page * 20 >= (data?.total || 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
