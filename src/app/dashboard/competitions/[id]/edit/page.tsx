"use client";

import React, { useState, useEffect } from "react";
import TrackingSettingsFields, { trackingSettingsError, TRACKING_DEFAULT_SECONDS } from "@/components/competitions/TrackingSettingsFields";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";

type FieldType = "short_text" | "long_text" | "dropdown" | "mcq" | "multi_select" | "date" | "rating" | "repeater";
type ValidationType = "none" | "number" | "bd_mobile";
type MappingType = "none" | "team_name" | "day_number" | "sales" | "profit" | "cups_sold" | "cup_revenue" | "packets_sold" | "packet_revenue";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options: string[];
  validation: ValidationType;
  mapping: MappingType;
  subFields?: FormField[];
}

export default function EditCompetitionPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const batchSelectRef = React.useRef<HTMLSelectElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [batchName, setBatchName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState<number | "">(TRACKING_DEFAULT_SECONDS);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [batches, setBatches] = useState<string[]>([]);

  useEffect(() => {
    fetchCompetition();
    fetchBatches();
  }, [id]);

  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/batch-info?all=true");
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.data || []);
        const uniqueNames = Array.from(new Set(rawList.map((b: any) => b.batchName))).filter(Boolean) as string[];
        uniqueNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
        setBatches(uniqueNames);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCompetition = async () => {
    try {
      const res = await fetch(`/api/competitions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || "");
        setDescription(data.description || "");
        setBatchName(data.batchName || "");
        setIsActive(data.isActive !== undefined ? data.isActive : true);
        setTrackingEnabled(!!data.trackingEnabled);
        setTrackingInterval(data.trackingIntervalSeconds || TRACKING_DEFAULT_SECONDS);
        setFields(Array.isArray(data.schema) ? data.schema : []);
      } else {
        toast.error("Failed to load competition details");
      }
    } catch (e) {
      toast.error("Error loading competition");
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([
      ...fields,
      {
        id: Math.random().toString(36).substring(2, 9),
        type: "short_text",
        label: "",
        placeholder: "",
        required: true,
        options: [],
        validation: "none",
        mapping: "none",
      }
    ]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Competition Title is required!");
      window.scrollTo({ top: 0, behavior: "smooth" });
      titleInputRef.current?.focus();
      return;
    }

    if (!batchName.trim()) {
      toast.error("Please select a Batch Name!");
      window.scrollTo({ top: 0, behavior: "smooth" });
      batchSelectRef.current?.focus();
      return;
    }

    if (fields.length === 0) {
      toast.error("Please add at least one question");
      return;
    }

    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label || !fields[i].label.trim()) {
        toast.error(`Question #${i + 1} requires a question label.`);
        return;
      }
    }
    
    const trackingError = trackingSettingsError(trackingEnabled, trackingInterval);
    if (trackingError) {
      toast.error(trackingError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/competitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          batchName: batchName.trim(),
          schema: fields,
          isActive,
          trackingEnabled,
          trackingIntervalSeconds: trackingEnabled ? trackingInterval : undefined,
        })
      });

      if (res.ok) {
        toast.success("Competition updated successfully!");
        router.push("/dashboard/competitions");
        return;
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || `Failed to update competition (${res.status})`);
      }
    } catch (error) {
      toast.error("Error updating competition");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-2"></div>
        <p className="text-sm">Loading Competition Form...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24 font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/competitions" className="hover:text-emerald-600 font-medium">
              Competitions
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">Edit Form</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Edit Competition Form</h1>
        </div>

        <Link
          href="/dashboard/competitions"
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
        >
          <span>←</span> Back
        </Link>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Competition Title <span className="text-red-500">*</span></label>
            <input 
              ref={titleInputRef}
              required 
              type="text" 
              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-medium"
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Battle of Cups"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Batch Name <span className="text-red-500">*</span></label>
              <select 
                ref={batchSelectRef}
                required 
                className="w-full border rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-medium"
                value={batchName} 
                onChange={(e) => setBatchName(e.target.value)}
              >
                <option value="">-- Select Batch --</option>
                {batches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Form Status</label>
              <select 
                className="w-full border rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-medium"
                value={isActive ? "active" : "ended"} 
                onChange={(e) => setIsActive(e.target.value === "active")}
              >
                <option value="active">Active (Open for submissions)</option>
                <option value="ended">Ended (Closed)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <textarea 
              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 text-sm font-medium"
              rows={3}
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <TrackingSettingsFields
            enabled={trackingEnabled}
            interval={trackingInterval}
            onEnabled={setTrackingEnabled}
            onInterval={setTrackingInterval}
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-800">Form Questions ({fields.length})</h2>
          </div>
          
          {fields.map((field, index) => (
            <div key={field.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative">
              <button 
                type="button" 
                onClick={() => removeField(field.id)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 px-2.5 py-1 rounded border border-red-200 transition"
              >
                Delete Question
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-16">
                <div>
                  <label className="block text-sm font-medium mb-1">Question Label</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-md p-2 text-sm font-medium"
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Placeholder Text</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-md p-2 text-sm"
                    placeholder="e.g. আজকে কত কাপ সেল হয়েছে?"
                    value={field.placeholder || ''}
                    onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select 
                    className="w-full border rounded-md p-2 text-sm"
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                  >
                    <option value="short_text">Short Text</option>
                    <option value="long_text">Long Text</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="mcq">Multiple Choice</option>
                    <option value="multi_select">Multi Select</option>
                    <option value="date">Date Picker</option>
                    <option value="rating">Rating (1-5 Stars)</option>
                    <option value="repeater">Repeater (Dynamic Block)</option>
                  </select>
                </div>
              </div>

              {(field.type === 'dropdown' || field.type === 'mcq' || field.type === 'multi_select') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Options (comma separated)</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-md p-2 text-sm"
                    value={Array.isArray(field.options) ? field.options.join(', ') : field.options || ''}
                    onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input 
                    type="checkbox" 
                    checked={field.required} 
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                    className="accent-emerald-600"
                  />
                  Required
                </label>
                
                <label className="flex items-center gap-2 text-sm">
                  Validation:
                  <select 
                    className="border rounded p-1 text-sm bg-slate-50"
                    value={field.validation || 'none'}
                    onChange={(e) => updateField(field.id, { validation: e.target.value as ValidationType })}
                  >
                    <option value="none">General (Any)</option>
                    <option value="number">Number Only</option>
                    <option value="bd_mobile">BD Mobile (11 digits)</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  Mapping (for Reports):
                  <select 
                    className="border rounded p-1 text-sm bg-slate-50"
                    value={field.mapping || 'none'}
                    onChange={(e) => updateField(field.id, { mapping: e.target.value as MappingType })}
                  >
                    <option value="none">None</option>
                    <option value="team_name">Team Name</option>
                    <option value="day_number">Day Number</option>
                    <option value="sales">Total Sales (Tk)</option>
                    <option value="profit">Total Profit (Tk)</option>
                    <option value="cups_sold">Cups Sold</option>
                    <option value="cup_revenue">Cup Revenue</option>
                    <option value="packets_sold">Packets Sold</option>
                    <option value="packet_revenue">Packet Revenue</option>
                  </select>
                </label>
              </div>
            </div>
          ))}

          <button 
            type="button" 
            onClick={addField}
            className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-slate-600 font-semibold hover:bg-slate-50 hover:border-emerald-400 transition"
          >
            + Add Question
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
          <Link
            href="/dashboard/competitions"
            className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
          >
            Cancel
          </Link>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-bold shadow-md transition flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Saving Changes...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
