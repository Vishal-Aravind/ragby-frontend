export default function StatCard({ icon: Icon, label, value, sublabel, color = "blue" }) {
  const bg = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  }[color] || "bg-blue-50 text-blue-600";

  return (
    <div className="bg-white border rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}
