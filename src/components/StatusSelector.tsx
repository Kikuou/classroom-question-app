"use client";

import { useState } from "react";

const STATUSES = [
  { value: "pending", label: "未対応", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  { value: "answered", label: "回答済", color: "text-green-700 bg-green-50 border-green-200" },
  { value: "later", label: "後で扱う", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "hidden", label: "非表示", color: "text-gray-500 bg-gray-50 border-gray-200" },
];

interface StatusSelectorProps {
  questionId: number;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

export function StatusSelector({ questionId, currentStatus, onStatusChange }: StatusSelectorProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (loading || newStatus === status) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          onClick={() => handleChange(s.value)}
          disabled={loading}
          className={`text-xs px-2 py-1 rounded border font-medium transition-all ${
            status === s.value
              ? s.color + " ring-1 ring-offset-0 ring-current"
              : "text-gray-400 bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
