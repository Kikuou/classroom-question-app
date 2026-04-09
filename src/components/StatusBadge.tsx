const STATUS_LABELS: Record<string, string> = {
  pending: "未対応",
  answered: "回答済",
  later: "後で扱う",
  hidden: "非表示",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  answered: "bg-green-100 text-green-800",
  later: "bg-blue-100 text-blue-800",
  hidden: "bg-gray-100 text-gray-500",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
        STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
