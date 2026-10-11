"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";

interface Group {
  id: string;
  groupName: string;
  batchName: string;
  members: { roll: string; name: string; isLeader?: boolean }[];
}

export default function SubmitCompetitionForm() {
  const params = useParams();
  const id = params.id as string;
  
  const [competition, setCompetition] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [subType, setSubType] = useState<"team"|"individual">("team");
  const [rollNumber, setRollNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [absentRolls, setAbsentRolls] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchCompetition();
  }, [id]);

  const fetchCompetition = async () => {
    try {
      const res = await fetch(`/api/competitions/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCompetition(data);
      
      // Fetch students for the batch
      const stdRes = await fetch(`/api/batch-info?batchName=${encodeURIComponent(data.batchName)}&public=true`);
      if (stdRes.ok) {
        const stds = await stdRes.json();
        setStudents(Array.isArray(stds) ? stds : []);
      }

      // Fetch groups for the batch
      const groupRes = await fetch(`/api/competitions/groups?batchName=${encodeURIComponent(data.batchName)}`);
      if (groupRes.ok) {
        const grps = await groupRes.json();
        setGroups(Array.isArray(grps) ? grps : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRollChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roll = e.target.value;
    setRollNumber(roll);
    
    // Auto-fill student name
    const student = students.find(s => s.roll === roll);
    if (student) {
      setStudentName(student.name);
    } else {
      setStudentName("");
    }
  };

  // Team-wise flow: the team is picked first, then the roll/absent pickers are
  // limited to that team's members. Without official groups the team name is
  // free text and the whole batch stays selectable.
  const teamFirst = subType === "team" && groups.length > 0;
  const selectedGroup = teamFirst ? groups.find(g => g.groupName === teamName) : undefined;
  const teamMembers = selectedGroup && Array.isArray(selectedGroup.members) ? selectedGroup.members : [];
  const leaderRoll = teamMembers.find(m => m.isLeader)?.roll;
  const rollOptions: { roll: string; name: string }[] = teamFirst ? teamMembers : students;

  const resetMemberSelection = () => {
    setRollNumber("");
    setStudentName("");
    setAbsentRolls([]);
  };

  const handleSubTypeChange = (type: "team" | "individual") => {
    if (type === subType) return;
    setSubType(type);
    resetMemberSelection();
  };

  const handleTeamChange = (name: string) => {
    setTeamName(name);
    resetMemberSelection();
  };

  const addAbsentRollSlot = () => {
    setAbsentRolls(prev => [...prev, ""]);
  };

  const updateAbsentRollSlot = (index: number, roll: string) => {
    setAbsentRolls(prev => {
      const next = [...prev];
      next[index] = roll;
      return next;
    });
  };

  const removeAbsentRollSlot = (index: number) => {
    setAbsentRolls(prev => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleRepeaterChange = (fieldId: string, index: number, subFieldId: string, value: any) => {
    setFormData(prev => {
      const arr = [...(prev[fieldId] || [])];
      if (!arr[index]) arr[index] = {};
      arr[index][subFieldId] = value;
      return { ...prev, [fieldId]: arr };
    });
  };

  const addRepeaterItem = (fieldId: string) => {
    setFormData(prev => {
      const arr = [...(prev[fieldId] || [])];
      arr.push({});
      return { ...prev, [fieldId]: arr };
    });
  };

  const removeRepeaterItem = (fieldId: string, index: number) => {
    setFormData(prev => {
      const arr = [...(prev[fieldId] || [])];
      arr.splice(index, 1);
      return { ...prev, [fieldId]: arr };
    });
  };

  const validateField = (field: any, value: any) => {
    if (field.type === 'repeater') {
      if (field.required && (!value || value.length === 0)) return `${field.label} is required. Please add at least one item.`;
      if (value && value.length > 0) {
        for (let i = 0; i < value.length; i++) {
          for (const sub of (field.subFields || [])) {
            if (sub.required && !value[i][sub.id]) return `${field.label} (Item ${i + 1}): ${sub.label} is required.`;
            if (value[i][sub.id] && sub.validation === 'bd_mobile') {
              if (!/^01[3-9]\d{8}$/.test(value[i][sub.id])) return `${field.label} (Item ${i + 1}): ${sub.label} must be a valid 11-digit BD mobile number.`;
            }
          }
        }
      }
      return null;
    }

    if (field.required && !value && value !== 0) return `${field.label} is required.`;
    if (value && field.validation === 'number' && isNaN(Number(value))) return `${field.label} must be a number.`;
    if (value && field.validation === 'bd_mobile') {
      const regex = /^01[3-9]\d{8}$/;
      if (!regex.test(value)) return `${field.label} must be a valid 11-digit Bangladeshi mobile number starting with 0.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subType === "team" && !teamName) return toast.error("Please select your Team Name");
    if (!rollNumber) return toast.error("Please select your Roll Number");

    for (const field of competition.schema) {
      const error = validateField(field, formData[field.id]);
      if (error) {
        toast.error(error);
        return;
      }
    }

    const cleanAbsentRolls = absentRolls.filter(r => r && r.trim() !== "");
    const finalData = {
      ...formData,
      ...(subType === "team" && cleanAbsentRolls.length > 0 ? { absentRolls: cleanAbsentRolls } : {})
    };

    try {
      const res = await fetch(`/api/competitions/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: subType,
          teamName: subType === "team" ? teamName : null,
          rollNumber,
          studentName,
          data: finalData
        })
      });

      if (res.ok) {
        toast.success("Submitted successfully!");
        setFormData({});
        setRollNumber("");
        setStudentName("");
        setTeamName("");
        setAbsentRolls([]);
      } else {
        const d = await res.json();
        toast.error(d.error || "Submission failed");
      }
    } catch (e) {
      toast.error("Error submitting form");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center text-slate-800 p-6">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium tracking-wide text-sm">Loading Submission Form...</p>
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center text-slate-700 p-6">
        <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center max-w-md shadow-md">
          <p className="text-xl font-bold text-slate-800">Form Not Available</p>
          <p className="text-sm text-slate-500 mt-2">The competition form was not found or is currently inactive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-6 sm:py-12 px-3 sm:px-6 lg:px-8 flex justify-center items-center font-sans">
      
      {/* Default Theme Form Card Wrapper */}
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden relative">

        {/* Card Header Banner (Vibrant Premium Emerald Banner) */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-8 sm:p-10 text-white relative flex flex-col items-center text-center shadow-sm">
          <span 
            style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.2)" }} 
            className="no-gradient inline-block border border-white/30 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-2 shadow-sm"
          >
            BATCH: {competition.batchName}
          </span>
          <h1 
            style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff", backgroundImage: "none" }} 
            className="no-gradient text-2xl sm:text-4xl font-black text-white tracking-tight text-center drop-shadow-md mt-1"
          >
            {competition.title}
          </h1>
          {competition.description && (
            <p 
              style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }} 
              className="no-gradient mt-2.5 text-sm sm:text-base text-emerald-50 font-medium leading-relaxed text-center max-w-lg"
            >
              {competition.description}
            </p>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* Submission Type Toggle Pills */}
          <div className="bg-slate-100 p-3 sm:p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
              Submission Type
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => handleSubTypeChange("team")}
                className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap border ${
                  subType === "team"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>👥</span> <span>Team-wise</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubTypeChange("individual")}
                className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap border ${
                  subType === "individual"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>👤</span> <span>Individual</span>
              </button>
            </div>
          </div>

          {/* Team Name Selector (Dropdown from Created Groups) — picked first for team reports */}
          {subType === "team" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Team Name <span className="text-red-500">*</span>
              </label>

              {groups.length > 0 ? (
                <select
                  required
                  className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm font-medium"
                  value={teamName}
                  onChange={(e) => handleTeamChange(e.target.value)}
                >
                  <option value="">-- Select Official Team Name --</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.groupName}>
                      {g.groupName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type="text"
                  className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm placeholder:text-slate-400"
                  placeholder="Enter your official team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Student & Roll Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                value={rollNumber}
                onChange={handleRollChange}
                disabled={teamFirst && !selectedGroup}
              >
                <option value="">
                  {teamFirst && !selectedGroup ? "-- Select Team First --" : "-- Select Roll --"}
                </option>
                {rollOptions.map(s => (
                  <option key={s.roll} value={s.roll}>
                    {teamFirst ? `${s.roll} - ${s.name}${s.roll === leaderRoll ? " (Leader)" : ""}` : s.roll}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Student Name
              </label>
              <input
                type="text"
                readOnly
                className="w-full bg-slate-100 text-slate-600 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium cursor-not-allowed"
                value={studentName}
                placeholder="Auto-filled from Roll"
              />
            </div>
          </div>

          {/* Absent Team Members Selector (TEAM SUBMISSIONS ONLY) */}
          {subType === "team" && (
            <div className="bg-amber-50/70 border border-amber-200 p-3.5 sm:p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center gap-2">
                <label className="block text-xs font-bold text-amber-950 leading-snug flex-1">
                  টিমের মধ্যে কেউ অনুপস্থিত থাকলে তার রোল নম্বর সিলেক্ট করুন (Optional)
                </label>
                <button
                  type="button"
                  onClick={addAbsentRollSlot}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1.5 rounded-md shadow-sm transition whitespace-nowrap flex-shrink-0"
                >
                  + Add Roll
                </button>
              </div>

              {absentRolls.length === 0 ? (
                <p className="text-xs text-amber-800 italic">
                  No absent member added. Click "+ Add Roll" above if anyone in your team is absent today.
                </p>
              ) : (
                <div className="space-y-2">
                  {absentRolls.map((absRoll, idx) => (
                    <div key={idx} className="flex items-center gap-2 w-full max-w-full">
                      <select
                        value={absRoll}
                        onChange={(e) => updateAbsentRollSlot(idx, e.target.value)}
                        className="flex-1 min-w-0 max-w-full bg-white border border-amber-300 text-slate-900 px-3 py-2 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium truncate"
                      >
                        <option value="">-- Select Absent Student Roll --</option>
                        {rollOptions
                          .filter((s) => s.roll !== rollNumber && (s.roll === absRoll || !absentRolls.includes(s.roll)))
                          .map((s) => (
                            <option key={s.roll} value={s.roll}>
                              {s.roll} - {s.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeAbsentRollSlot(idx)}
                        className="text-red-600 hover:text-red-800 text-xs font-bold bg-white px-2.5 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-slate-200 my-6"></div>

          {/* Dynamic Schema Fields */}
          <div className="space-y-5">
            {competition.schema.map((field: any) => {
              return (
                <div key={field.id} className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  
                  {field.type === 'short_text' && (
                    <input 
                      type={field.validation === 'number' ? 'number' : 'text'}
                      className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm placeholder:text-slate-400 font-medium"
                      value={formData[field.id] !== undefined ? formData[field.id] : ''}
                      placeholder={field.placeholder || ''}
                      onChange={e => handleFieldChange(field.id, e.target.value)}
                      onWheel={(e) => field.validation === 'number' && (e.target as HTMLElement).blur()}
                      required={field.required}
                    />
                  )}

                  {field.type === 'long_text' && (
                    <textarea 
                      className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm placeholder:text-slate-400 font-medium"
                      rows={6}
                      value={formData[field.id] || ''}
                      placeholder={field.placeholder || 'Describe your learning experience today...'}
                      onChange={e => handleFieldChange(field.id, e.target.value)}
                      required={field.required}
                    />
                  )}

                  {field.type === 'dropdown' && (
                    <select 
                      className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm font-medium"
                      value={formData[field.id] || ''}
                      onChange={e => handleFieldChange(field.id, e.target.value)}
                      required={field.required}
                    >
                      <option value="">-- Select Option --</option>
                      {field.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'mcq' && (
                    <div className="space-y-2 pt-1">
                      {field.options?.map((opt: string) => (
                        <label key={opt} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                          <input 
                            type="radio" 
                            name={field.id} 
                            value={opt}
                            checked={formData[field.id] === opt}
                            onChange={e => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            className="accent-emerald-600 w-4 h-4"
                          />
                          <span className="text-sm font-medium text-slate-800">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === 'date' && (
                    <input 
                      type="date"
                      className="w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm font-medium"
                      value={formData[field.id] || ''}
                      onChange={e => handleFieldChange(field.id, e.target.value)}
                      required={field.required}
                    />
                  )}

                  {/* Rating Field - Larger Stars & Centered */}
                  {field.type === 'rating' && (
                    <div className="flex justify-center items-center gap-3 sm:gap-4 py-4 bg-slate-50 border border-slate-200 rounded-xl my-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          className={`text-4xl sm:text-5xl transition-transform hover:scale-125 active:scale-95 ${
                            formData[field.id] >= star ? 'text-amber-400 drop-shadow' : 'text-slate-300'
                          }`}
                          onClick={() => handleFieldChange(field.id, star)}
                        >
                          ★
                        </button>
                      ))}
                      {field.required && !formData[field.id] && <input type="hidden" required />}
                    </div>
                  )}

                  {field.type === 'repeater' && (
                    <div className="mt-2 space-y-4">
                      {(formData[field.id] || []).map((item: any, idx: number) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative shadow-sm">
                          <button
                            type="button"
                            onClick={() => removeRepeaterItem(field.id, idx)}
                            className="absolute top-3 right-3 text-red-600 hover:text-red-700 text-xs font-bold bg-red-100 px-2.5 py-1 rounded-md border border-red-200 transition"
                          >
                            Remove
                          </button>
                          <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                            Item #{idx + 1}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {field.subFields?.map((sub: any) => (
                              <div key={sub.id}>
                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                  {sub.label} {sub.required && <span className="text-red-500">*</span>}
                                </label>
                                {sub.type === 'short_text' && (
                                  <input 
                                    type={sub.validation === 'number' ? 'number' : 'text'}
                                    className="w-full bg-white text-slate-900 border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    value={item[sub.id] || ''}
                                    placeholder={sub.placeholder || ''}
                                    onChange={e => handleRepeaterChange(field.id, idx, sub.id, e.target.value)}
                                    onWheel={(e) => sub.validation === 'number' && (e.target as HTMLElement).blur()}
                                    required={sub.required}
                                  />
                                )}
                                {sub.type === 'dropdown' && (
                                  <select 
                                    className="w-full bg-white text-slate-900 border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                    value={item[sub.id] || ''}
                                    onChange={e => handleRepeaterChange(field.id, idx, sub.id, e.target.value)}
                                    required={sub.required}
                                  >
                                    <option value="">-- Select --</option>
                                    {sub.options?.map((o:string) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addRepeaterItem(field.id)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-semibold border border-emerald-300 transition flex items-center gap-2"
                      >
                        <span>+</span> Add Item
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base sm:text-lg py-4 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              <span>🚀</span> Submit Battle Report
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
