import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

function RiskChart({ failureProbability, complexity, deadline }) {
  const complexityScore = {
    'low': 3, 'medium': 5, 'high': 8,
  }[String(complexity || '').toLowerCase()] || 5

  const deadlineScore = {
    'tight': 8, 'moderate': 5, 'relaxed': 3,
  }[String(deadline || '').toLowerCase()] || 5

  const probability = failureProbability || 0

  const barData = [
    { name: 'Risk', value: probability, fill: '#ef4444' },
    { name: 'Complexity', value: complexityScore * 10, fill: '#f59e0b' },
    { name: 'Deadline', value: deadlineScore * 10, fill: '#3b82f6' },
  ]

  const radarData = [
    { metric: 'Risk', value: probability },
    { metric: 'Complexity', value: complexityScore * 10 },
    { metric: 'Timeline', value: deadlineScore * 10 },
    { metric: 'Team Gap', value: Math.min(probability * 0.8, 100) },
    { metric: 'Scope', value: complexityScore * 12 },
  ]

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        {/* Bar Chart */}
        <div className="h-28 bg-white border border-gray-100 rounded-xl p-1.5 shadow-xs flex flex-col justify-between">
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: -30, right: 5, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', padding: '2px 6px', fontSize: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  formatter={(value) => [`${value}%`, 'Score']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="h-28 bg-white border border-gray-100 rounded-xl p-1.5 shadow-xs flex flex-col justify-between">
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 2, bottom: 2, left: 2, right: 2 }}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 8, fill: '#64748b' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Risk Profile"
                  dataKey="value"
                  stroke="#0d9488"
                  fill="#0d9488"
                  fillOpacity={0.12}
                  strokeWidth={1.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-200/80">
        <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-lg text-[9px] font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
          <span>Failure Risk: {probability}%</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[9px] font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
          <span>Complexity: {complexity || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[9px] font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span>Timeline: {deadline || 'N/A'}</span>
        </div>
      </div>
    </div>
  )
}

export default RiskChart
