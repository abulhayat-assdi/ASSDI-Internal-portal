"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  formatReportDate,
  formatTaka,
  groupMembers,
  paymentStatusOf,
  procurementByTeam,
  procurementDue,
  procurementTotals,
  roundMoney,
  type PaymentStatus,
} from "@/lib/competitions";

interface Product {
  id: string;
  name: string;
  unitPrice: number;
}

interface Group {
  id: string;
  groupName: string;
  members: unknown;
}

interface Entry {
  id: string;
  productId: string;
  productName: string;
  groupId: string;
  groupName: string;
  memberRoll: string;
  memberName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paidAmount: number;
  procuredOn: string;
  note: string | null;
  recordedBy: string;
}

interface Detail {
  competition: { id: string; title: string; batchName: string };
  today: string;
  products: Product[];
  entries: Entry[];
  groups: Group[];
}

const STATUS_LABEL: Record<PaymentStatus, string> = { paid: "Paid", due: "Due", partial: "Partial" };
const STATUS_STYLE: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  due: "bg-red-50 text-red-700 border-red-200",
  partial: "bg-amber-50 text-amber-800 border-amber-200",
};

const inputClass =
  "w-full bg-white text-slate-900 border border-slate-300 px-3 py-2.5 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500";
const labelClass = "block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1";

const emptyForm = (today: string) => ({
  id: "",
  groupId: "",
  memberRoll: "",
  productId: "",
  quantity: "1",
  // Empty means "pieces x price"; it only holds a value once staff type one.
  amount: "",
  payment: "due" as PaymentStatus,
  paid: "",
  procuredOn: today,
  note: "",
});

export default function CompetitionProcurementPage() {
  const { id } = useParams() as { id: string };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const [productForm, setProductForm] = useState({ id: "", name: "", unitPrice: "" });
  const [savingProduct, setSavingProduct] = useState(false);

  const [form, setForm] = useState(emptyForm(""));
  const [saving, setSaving] = useState(false);

  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/competitions/${id}/procurement`);
      if (!res.ok) throw new Error();
      const data: Detail = await res.json();
      setDetail(data);
      setForm((prev) => (prev.procuredOn ? prev : { ...prev, procuredOn: data.today }));
    } catch {
      toast.error("Failed to load procurement data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const products = useMemo(() => detail?.products || [], [detail]);
  const groups = useMemo(() => detail?.groups || [], [detail]);
  const entries = useMemo(() => detail?.entries || [], [detail]);

  // ── Entry form maths ────────────────────────────────────────────────────
  const selectedGroup = groups.find((g) => g.id === form.groupId) || null;
  const selectedProduct = products.find((p) => p.id === form.productId) || null;
  const quantity = Math.max(0, Math.floor(Number(form.quantity) || 0));
  const autoAmount = roundMoney(quantity * (selectedProduct?.unitPrice || 0));
  const total = form.amount === "" ? autoAmount : roundMoney(Number(form.amount));
  const paid = form.payment === "paid" ? total : form.payment === "due" ? 0 : roundMoney(Number(form.paid));
  const due = procurementDue(total, paid);

  const resetForm = () => setForm(emptyForm(detail?.today || ""));

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupId) return toast.error("Please select a team.");
    if (!form.memberRoll) return toast.error("Please select the member who took the product.");
    if (!form.productId) return toast.error("Please select a product.");
    if (quantity < 1) return toast.error("Quantity must be 1 or more.");
    if (!(total >= 0)) return toast.error("Amount must be 0 or more.");
    if (!(paid >= 0) || paid > total) return toast.error("Paid amount must be between 0 and the total amount.");

    setSaving(true);
    try {
      const res = await fetch(`/api/competitions/${id}/procurement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id || undefined,
          groupId: form.groupId,
          memberRoll: form.memberRoll,
          productId: form.productId,
          quantity,
          totalAmount: total,
          paidAmount: paid,
          procuredOn: form.procuredOn,
          note: form.note,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(d.error || "Failed to save entry");
      toast.success(form.id ? "Entry updated" : "Procurement saved");
      resetForm();
      load();
    } catch {
      toast.error("Error saving entry");
    } finally {
      setSaving(false);
    }
  };

  const editEntry = (entry: Entry) => {
    const status = paymentStatusOf(entry.totalAmount, entry.paidAmount);
    setForm({
      id: entry.id,
      groupId: entry.groupId,
      memberRoll: entry.memberRoll,
      productId: entry.productId,
      quantity: String(entry.quantity),
      amount: String(entry.totalAmount),
      payment: status,
      paid: status === "partial" ? String(entry.paidAmount) : "",
      procuredOn: entry.procuredOn,
      note: entry.note || "",
    });
    document.getElementById("procurement-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deleteEntry = async (entry: Entry) => {
    if (!window.confirm(`Delete this entry?\n${entry.groupName} · ${entry.memberName} · ${entry.quantity} × ${entry.productName}`)) return;
    const res = await fetch(`/api/competitions/${id}/procurement?entryId=${entry.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete entry");
    toast.success("Entry deleted");
    if (form.id === entry.id) resetForm();
    load();
  };

  // ── Products ────────────────────────────────────────────────────────────
  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return toast.error("Product name is required.");
    if (productForm.unitPrice === "" || Number(productForm.unitPrice) < 0) return toast.error("Enter the price per piece.");

    setSavingProduct(true);
    try {
      const res = await fetch(`/api/competitions/${id}/procurement/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productForm.id || undefined, name: productForm.name, unitPrice: Number(productForm.unitPrice) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(d.error || "Failed to save product");
      toast.success(productForm.id ? "Product updated" : "Product added");
      setProductForm({ id: "", name: "", unitPrice: "" });
      load();
    } catch {
      toast.error("Error saving product");
    } finally {
      setSavingProduct(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete product "${product.name}"?`)) return;
    const res = await fetch(`/api/competitions/${id}/procurement/products?productId=${product.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error || "Failed to delete product");
    toast.success("Product deleted");
    load();
  };

  // ── Table ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (teamFilter !== "all" && e.groupId !== teamFilter) return false;
      if (statusFilter !== "all" && paymentStatusOf(e.totalAmount, e.paidAmount) !== statusFilter) return false;
      if (q && !`${e.memberRoll} ${e.memberName} ${e.productName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, teamFilter, statusFilter, search]);

  const grand = useMemo(() => procurementTotals(entries), [entries]);
  const filteredTotals = useMemo(() => procurementTotals(filtered), [filtered]);
  const byTeam = useMemo(() => procurementByTeam(entries), [entries]);

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-2"></div>
        <p className="text-sm">Loading procurement...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <p className="text-lg font-bold text-slate-800">Competition not found</p>
        <Link href="/dashboard/competitions" className="inline-block mt-3 text-sm font-bold text-emerald-700">← Back to Competitions</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/dashboard/competitions" className="hover:text-emerald-600 font-medium">Competitions</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">{detail.competition.title}</span>
          <span>/</span>
          <span className="text-slate-700 font-medium">Procurement</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">🛒 Procurement</h1>
        <p className="text-sm text-slate-500 mt-1">
          Record which team took which product, how many pieces, and how much is paid or still due. Batch: {detail.competition.batchName}
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pieces Given", value: grand.quantity.toLocaleString("en-US"), style: "text-slate-900" },
          { label: "Total Amount", value: formatTaka(grand.total), style: "text-slate-900" },
          { label: "Paid", value: formatTaka(grand.paid), style: "text-emerald-700" },
          { label: "Due", value: formatTaka(grand.due), style: "text-red-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-black mt-1 ${c.style}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Products */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-bold text-slate-800">Products</h2>
            <p className="text-xs text-slate-500 mt-0.5">Add each product once with its price per piece. Amounts are calculated from it.</p>
          </div>
          <form onSubmit={saveProduct} className="p-4 space-y-3 border-b border-slate-200">
            <div>
              <label className={labelClass}>Product Name</label>
              <input
                className={inputClass}
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="e.g. Tea Cup"
              />
            </div>
            <div>
              <label className={labelClass}>Price per Piece (৳)</label>
              <input
                type="number"
                min="0"
                step="any"
                className={inputClass}
                value={productForm.unitPrice}
                onChange={(e) => setProductForm({ ...productForm, unitPrice: e.target.value })}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="e.g. 12"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingProduct}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition"
              >
                {savingProduct ? "Saving..." : productForm.id ? "Update Product" : "+ Add Product"}
              </button>
              {productForm.id && (
                <button
                  type="button"
                  onClick={() => setProductForm({ id: "", name: "", unitPrice: "" })}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          {products.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No product yet. Add the first one above.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {products.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{formatTaka(p.unitPrice)} per piece</p>
                  </div>
                  <div className="flex-shrink-0 flex gap-2 text-xs font-semibold">
                    <button
                      onClick={() => setProductForm({ id: p.id, name: p.name, unitPrice: String(p.unitPrice) })}
                      className="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProduct(p)}
                      className="text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Entry form */}
        <div id="procurement-form" className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-800">{form.id ? "Edit Procurement Entry" : "Add Procurement Entry"}</h2>
            {form.id && (
              <button onClick={resetForm} className="text-xs font-bold text-slate-500 hover:text-slate-800">✕ Cancel edit</button>
            )}
          </div>
          {groups.length === 0 || products.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {groups.length === 0 ? (
                <>
                  No team exists for this batch yet.{" "}
                  <Link href="/dashboard/competitions/groups" className="font-bold text-emerald-700">Create teams first →</Link>
                </>
              ) : (
                "Add at least one product first."
              )}
            </p>
          ) : (
            <form onSubmit={saveEntry} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Team</label>
                  <select
                    className={inputClass}
                    value={form.groupId}
                    onChange={(e) => setForm({ ...form, groupId: e.target.value, memberRoll: "" })}
                  >
                    <option value="">-- Select team --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.groupName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Member who took it</label>
                  <select
                    className={inputClass}
                    value={form.memberRoll}
                    disabled={!selectedGroup}
                    onChange={(e) => setForm({ ...form, memberRoll: e.target.value })}
                  >
                    <option value="">{selectedGroup ? "-- Select member --" : "Select a team first"}</option>
                    {groupMembers(selectedGroup).map((m) => (
                      <option key={m.roll} value={m.roll}>
                        {m.roll} · {m.name}{m.isLeader ? " (Leader)" : m.isDeputy ? " (Deputy)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Product</label>
                  <select className={inputClass} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, amount: "" })}>
                    <option value="">-- Select product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatTaka(p.unitPrice)}/pc</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Quantity (pieces)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={inputClass}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value, amount: "" })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                  />
                </div>
                <div>
                  <label className={labelClass}>Total Amount (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inputClass}
                    value={form.amount === "" ? (selectedProduct ? String(autoAmount) : "") : form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="Pieces × price"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {form.amount === "" || total === autoAmount ? (
                      selectedProduct ? `Auto: ${quantity} × ${formatTaka(selectedProduct.unitPrice)}` : "Calculated from pieces × price."
                    ) : (
                      <button type="button" onClick={() => setForm({ ...form, amount: "" })} className="font-bold text-emerald-700">
                        Changed by hand — reset to {formatTaka(autoAmount)}
                      </button>
                    )}
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    max={detail.today}
                    value={form.procuredOn}
                    onChange={(e) => setForm({ ...form, procuredOn: e.target.value })}
                  />
                </div>
              </div>

              {/* Payment */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <label className={labelClass}>Payment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["paid", "due", "partial"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, payment: s })}
                      className={`py-2.5 rounded-lg text-sm font-bold border transition ${
                        form.payment === s ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {s === "paid" ? "Fully Paid" : s === "due" ? "Fully Due" : "Partly Paid"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Paid (৳)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className={inputClass}
                      disabled={form.payment !== "partial"}
                      value={form.payment === "partial" ? form.paid : String(paid)}
                      onChange={(e) => setForm({ ...form, paid: e.target.value })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      placeholder="How much is paid?"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Due (৳) — auto</label>
                    <div className={`px-3 py-2.5 rounded-lg border text-sm font-black ${due > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                      {formatTaka(due)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Note (optional)</label>
                <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Any remark" />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-sm transition"
              >
                {saving ? "Saving..." : form.id ? "Update Entry" : "Save Procurement"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Team summary */}
      {byTeam.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-bold text-slate-800">Team-wise Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Team</th>
                  <th className="px-5 py-3 text-right">Pieces</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {byTeam.map((t) => (
                  <tr key={t.groupId} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-900">{t.groupName}</td>
                    <td className="px-5 py-3 text-right text-slate-700">{t.quantity.toLocaleString("en-US")}</td>
                    <td className="px-5 py-3 text-right text-slate-700 font-medium">{formatTaka(t.total)}</td>
                    <td className="px-5 py-3 text-right text-emerald-700 font-medium">{formatTaka(t.paid)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${t.due > 0 ? "text-red-600" : "text-slate-400"}`}>{formatTaka(t.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-slate-800">
            All Entries <span className="font-medium text-slate-500 text-sm">({filtered.length} of {entries.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className={`${inputClass} !w-auto`}>
              <option value="all">All Teams</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.groupName}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={`${inputClass} !w-auto`}>
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="due">Due</option>
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member / product" className={`${inputClass} !w-52`} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{entries.length === 0 ? "No procurement recorded yet." : "No entry matches these filters."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Team</th>
                  <th className="px-4 py-3 whitespace-nowrap">Member</th>
                  <th className="px-4 py-3 whitespace-nowrap">Product</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Pieces</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Paid</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Due</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Given By</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((e) => {
                  const status = paymentStatusOf(e.totalAmount, e.paidAmount);
                  const entryDue = procurementDue(e.totalAmount, e.paidAmount);
                  return (
                    <tr key={e.id} className={`hover:bg-slate-50 align-top ${form.id === e.id ? "bg-emerald-50/60" : ""}`}>
                      <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{formatReportDate(e.procuredOn)}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{e.groupName}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-emerald-700 font-bold">{e.memberRoll}</span>{" "}
                        <span className="text-slate-700">{e.memberName}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {e.productName}
                        <span className="block text-[11px] text-slate-400">{formatTaka(e.unitPrice)}/pc</span>
                        {e.note && <span className="block text-[11px] text-slate-500 italic">{e.note}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{e.quantity.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-right text-slate-800 font-medium">{formatTaka(e.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatTaka(e.paidAmount)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${entryDue > 0 ? "text-red-600" : "text-slate-400"}`}>{formatTaka(entryDue)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{e.recordedBy}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2 text-xs font-semibold">
                        <button onClick={() => editEntry(e)} className="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md hover:bg-blue-100">Edit</button>
                        <button onClick={() => deleteEntry(e)} className="text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md hover:bg-red-100">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-emerald-50 border-t-2 border-emerald-200 font-black text-emerald-900">
                <tr>
                  <td className="px-4 py-3" colSpan={4}>Total ({filtered.length} entries)</td>
                  <td className="px-4 py-3 text-right">{filteredTotals.quantity.toLocaleString("en-US")}</td>
                  <td className="px-4 py-3 text-right">{formatTaka(filteredTotals.total)}</td>
                  <td className="px-4 py-3 text-right">{formatTaka(filteredTotals.paid)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{formatTaka(filteredTotals.due)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
