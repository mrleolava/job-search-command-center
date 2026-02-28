"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Application, ActivityLogEntry, PipelineStage, PIPELINE_STAGES } from "@/lib/types";
import { capitalize, timeAgo } from "@/lib/utils";

interface ApplicationDetailProps {
  application: Application;
  onClose: () => void;
  onUpdate: (updated: Application) => void;
}

export default function ApplicationDetail({
  application,
  onClose,
  onUpdate,
}: ApplicationDetailProps) {
  const [notes, setNotes] = useState(application.notes || "");
  const [contacts, setContacts] = useState(application.contacts || "");
  const [nextAction, setNextAction] = useState(application.next_action || "");
  const [nextActionDate, setNextActionDate] = useState(application.next_action_date || "");
  const [stage, setStage] = useState<PipelineStage>(application.stage);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(application.notes || "");
    setContacts(application.contacts || "");
    setNextAction(application.next_action || "");
    setNextActionDate(application.next_action_date || "");
    setStage(application.stage);
    fetchActivityLog();
  }, [application.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchActivityLog() {
    const supabase = createClient();
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .eq("application_id", application.id)
      .order("changed_at", { ascending: false });
    if (data) setActivityLog(data);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("applications")
      .update({
        notes,
        contacts,
        next_action: nextAction,
        next_action_date: nextActionDate || null,
        stage,
      })
      .eq("id", application.id)
      .select("*, jobs(*)")
      .single();

    if (!error && data) {
      onUpdate(data as Application);
      await fetchActivityLog();
    }
    setSaving(false);
  }

  const job = application.jobs;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <div className="text-sm text-gray-500">{job?.company}</div>
          <h2 className="text-lg font-semibold text-gray-900">{job?.title}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as PipelineStage)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {capitalize(s)}
              </option>
            ))}
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contacts</label>
          <textarea
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
            placeholder="Recruiter name, hiring manager, etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Action</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="Follow up, prep, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Date</label>
            <input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Activity Log</h3>
          {activityLog.length === 0 ? (
            <p className="text-sm text-gray-400">No activity recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {activityLog.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 text-xs whitespace-nowrap">
                    {timeAgo(entry.changed_at)}
                  </span>
                  <span className="text-gray-600">
                    {capitalize(entry.from_stage || "?")} → {capitalize(entry.to_stage || "?")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gray-900 text-white rounded-md py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
