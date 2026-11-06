"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function CreateCompetitionPage() {
  const router = useRouter();
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const batchSelectRef = React.useRef<HTMLSelectElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [batchName, setBatchName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [templates, setTemplates] = useState<{ id: string, name: string, schema: any }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [batches, setBatches] = useState<string[]>([]);

  useEffect(() => {
    fetchTemplates();
    fetchBatches();
  }, []);

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

  const fetchTemplates = async () => {
    const defaultBattleOfCupsTemplate = {
      id: "default-battle-of-cups",
      name: "🏆 Default: Battle of Cups",
      schema: [
        { id: "field_date", type: "date", label: "Date", required: true, options: [], validation: "none", mapping: "none" },
        { id: "field_day", type: "short_text", label: "Day Number", placeholder: "আজকে কততম দিন চলছে (যেমন: 1, 2...)", required: true, options: [], validation: "number", mapping: "day_number" },
        { id: "field_cups", type: "short_text", label: "Total Cups Sold", placeholder: "আজকে কত কাপ সেল হয়েছে?", required: true, options: [], validation: "number", mapping: "cups_sold" },
        { id: "field_cup_rev", type: "short_text", label: "Cup Revenue (Tk)", placeholder: "আজকে কত টাকার কাপ সেল করেছেন?", required: true, options: [], validation: "number", mapping: "none" },
        { id: "field_packets", type: "short_text", label: "Total Packets Sold", placeholder: "আজকে কত প্যাকেট সেল হয়েছে?", required: true, options: [], validation: "number", mapping: "packets_sold" },
        { id: "field_revenue", type: "short_text", label: "Packet Revenue (Tk)", placeholder: "আজকে কত টাকার প্যাকেট সেল করেছেন?", required: true, options: [], validation: "number", mapping: "packet_revenue" },
        { id: "field_sales", type: "short_text", label: "Total Sales (Tk)", placeholder: "আজকের মোট সেল (টাকা)", required: true, options: [], validation: "number", mapping: "sales" },
        { id: "field_profit", type: "short_text", label: "Total Profit (Tk)", placeholder: "আজকের মোট প্রফিট (টাকা)", required: true, options: [], validation: "number", mapping: "profit" },
        { id: "field_rating", type: "rating", label: "Overall Team Performance", required: true, options: [], validation: "none", mapping: "none" },
        { id: "field_summary", type: "long_text", label: "Brief summary of today's learning/experience", placeholder: "আজকের কাজের অভিজ্ঞতা সংক্ষেপে লিখুন...", required: false, options: [], validation: "none", mapping: "none" }
      ]
    };

    const defaultCorporateSalesTemplate = {
      id: "default-corporate-sales",
      name: "💼 Default: Corporate Sales",
      schema: [
        { id: "field_date", type: "date", label: "Date", required: true, options: [], validation: "none", mapping: "none" },
        { id: "field_companies_visited", type: "short_text", label: "Total Company Visited", placeholder: "আজকে কতটি কোম্পানি ভিজিট করেছেন?", required: true, options: [], validation: "number", mapping: "none" },
        { id: "field_conf_rev", type: "short_text", label: "Total Confirmed Revenue", placeholder: "আজকে মোট কত কনফার্মড রেভিনিউ এসেছে?", required: true, options: [], validation: "number", mapping: "sales" },
        { id: "field_rating", type: "rating", label: "Overall Team Performance", required: true, options: [], validation: "none", mapping: "none" },
        { id: "field_sector", type: "dropdown", label: "Which sector showed the highest interest today?", required: true, options: ["Retail", "Manufacturing", "IT/Software", "Education", "Healthcare", "Finance", "Small Business"], validation: "none", mapping: "none" },
        { id: "field_summary", type: "long_text", label: "Brief summary of today's experience", placeholder: "আজকের অভিজ্ঞতা সংক্ষেপে লিখুন...", required: true, options: [], validation: "none", mapping: "none" },
        { 
          id: "field_company_details", 
          type: "repeater", 
          label: "Company Details Visited", 
          required: true, 
          options: [], 
          validation: "none", 
          mapping: "none",
          subFields: [
            { id: "sub_name", type: "short_text", label: "Company Name", placeholder: "কোম্পানির নাম", required: true, options: [], validation: "none", mapping: "none" },
            { id: "sub_person", type: "short_text", label: "Contact Person Name", placeholder: "যোগাযোগকারীর নাম", required: true, options: [], validation: "none", mapping: "none" },
            { id: "sub_desig", type: "short_text", label: "Designation", placeholder: "পদবি", required: true, options: [], validation: "none", mapping: "none" },
            { id: "sub_mobile", type: "short_text", label: "Mobile Number", placeholder: "মোবাইল নম্বর", required: true, options: [], validation: "bd_mobile", mapping: "none" },
          ]
        }
      ]
    };

    try {
      const res = await fetch("/api/competitions/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates([defaultBattleOfCupsTemplate, defaultCorporateSalesTemplate, ...data]);
      } else {
        setTemplates([defaultBattleOfCupsTemplate, defaultCorporateSalesTemplate]);
      }
    } catch (e) {
      console.error(e);
      setTemplates([defaultBattleOfCupsTemplate, defaultCorporateSalesTemplate]);
    }
  };

  const handleApplyTemplate = () => {
    const t = templates.find(x => x.id === selectedTemplateId);
    if (t) {
      setFields(t.schema as FormField[]);
      if (!title.trim()) {
        const cleanName = t.name.replace(/^[^\w\s]+/, '').trim();
        setTitle(cleanName);
      }
      toast.success(`Applied template: ${t.name}`);
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

  const saveAsTemplate = async () => {
    const name = prompt("Enter template name:");
    if (!name) return;
    try {
      const res = await fetch("/api/competitions/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, schema: fields })
      });
      if (res.ok) {
        toast.success("Template saved!");
        fetchTemplates();
      }
    } catch (e) {
      toast.error("Failed to save template");
    }
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
      toast.error("Please add at least one question or apply a template");
      return;
    }

    // Ensure all fields have labels
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label || !fields[i].label.trim()) {
        toast.error(`Question #${i + 1} requires a question label.`);
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          batchName: batchName.trim(),
          schema: fields,
          isActive: true
        })
      });

      if (res.ok) {
        toast.success("Competition created successfully!");
        window.location.href = "/dashboard/competitions";
        return;
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || `Failed to create competition (${res.status})`);
      }
    } catch (error) {
      toast.error("Error submitting competition");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">Create Competition</h1>

      <div className="mb-6 flex gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Load Template</label>
          <select 
            className="w-full border rounded-md p-2 bg-white"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            <option value="">-- Select Template --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <button 
          type="button"
          onClick={handleApplyTemplate}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          disabled={!selectedTemplateId}
        >
          Apply
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Competition Title <span className="text-red-500">*</span></label>
            <input 
              ref={titleInputRef}
              required 
              type="text" 
              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Battle of Cups"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Batch Name <span className="text-red-500">*</span></label>
            <select 
              ref={batchSelectRef}
              required 
              className="w-full border rounded-md p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <textarea 
              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Form Questions</h2>
            <div className="space-x-3">
              <button type="button" onClick={saveAsTemplate} className="text-sm bg-gray-200 px-3 py-1.5 rounded hover:bg-gray-300">
                Save as Template
              </button>
            </div>
          </div>
          
          {fields.map((field, index) => (
            <div key={field.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 relative">
              <button 
                type="button" 
                onClick={() => removeField(field.id)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700"
              >
                Delete
              </button>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-12">
                <div>
                  <label className="block text-sm font-medium mb-1">Question Label</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-md p-2 text-sm"
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

              {field.type === 'repeater' && (
                <div className="mb-4 bg-gray-50 p-4 border rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">Sub-fields</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const updatedField = { ...field };
                        updatedField.subFields = updatedField.subFields || [];
                        updatedField.subFields.push({ id: Math.random().toString(36).substring(2, 9), type: 'short_text', label: '', required: true, options: [], validation: 'none', mapping: 'none' });
                        updateField(field.id, updatedField);
                      }}
                      className="text-xs bg-gray-200 px-2 py-1 rounded"
                    >
                      + Add Sub-field
                    </button>
                  </div>
                  {field.subFields?.map((subField, subIndex) => (
                    <div key={subField.id} className="grid grid-cols-12 gap-2 mb-2 items-center">
                      <div className="col-span-4">
                        <input 
                          type="text" 
                          placeholder="Label" 
                          className="w-full border rounded p-1 text-sm"
                          value={subField.label}
                          onChange={(e) => {
                            const newSub = [...(field.subFields || [])];
                            newSub[subIndex].label = e.target.value;
                            updateField(field.id, { subFields: newSub });
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        <input 
                          type="text" 
                          placeholder="Placeholder" 
                          className="w-full border rounded p-1 text-sm"
                          value={subField.placeholder || ''}
                          onChange={(e) => {
                            const newSub = [...(field.subFields || [])];
                            newSub[subIndex].placeholder = e.target.value;
                            updateField(field.id, { subFields: newSub });
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <select 
                          className="w-full border rounded p-1 text-sm"
                          value={subField.type}
                          onChange={(e) => {
                            const newSub = [...(field.subFields || [])];
                            newSub[subIndex].type = e.target.value as FieldType;
                            updateField(field.id, { subFields: newSub });
                          }}
                        >
                          <option value="short_text">Short Text</option>
                          <option value="dropdown">Dropdown</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <select 
                          className="w-full border rounded p-1 text-sm"
                          value={subField.validation}
                          onChange={(e) => {
                            const newSub = [...(field.subFields || [])];
                            newSub[subIndex].validation = e.target.value as ValidationType;
                            updateField(field.id, { subFields: newSub });
                          }}
                        >
                          <option value="none">Any</option>
                          <option value="number">Number</option>
                          <option value="bd_mobile">Mobile</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          type="button" 
                          onClick={() => {
                            const newSub = [...(field.subFields || [])];
                            newSub.splice(subIndex, 1);
                            updateField(field.id, { subFields: newSub });
                          }}
                          className="text-red-500 hover:text-red-700 text-xl font-bold leading-none"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!field.subFields || field.subFields.length === 0) && (
                    <p className="text-xs text-gray-400">No sub-fields added. Add one to collect data in this repeater.</p>
                  )}
                </div>
              )}

              {(field.type === 'dropdown' || field.type === 'mcq' || field.type === 'multi_select') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Options (comma separated)</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-md p-2"
                    value={field.options.join(', ')}
                    onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="Option 1, Option 2, Option 3"
                  />
                </div>
              )}

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={field.required} 
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  />
                  Required
                </label>
                
                <label className="flex items-center gap-2 text-sm">
                  Validation:
                  <select 
                    className="border rounded p-1 text-sm"
                    value={field.validation}
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
                    className="border rounded p-1 text-sm"
                    value={field.mapping}
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
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
          >
            + Add Question
          </button>
        </div>

        <div className="flex justify-end pt-6 border-t">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold shadow-lg transition flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                Creating Competition...
              </>
            ) : (
              "Create Competition"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
