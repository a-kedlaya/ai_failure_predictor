import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react'

function RiskSummary({ report }) {
  const probability = Number(report.failureProbability) || 0

  const getRiskConfig = (level) => {
    const normalized = String(level || '').toLowerCase()
    if (normalized.includes('high')) return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', icon: AlertTriangle }
    if (normalized.includes('low')) return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 }
    return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle }
  }

  const config = getRiskConfig(report.riskLevel)
  const Icon = config.icon
  const gaugeData = [
    { value: probability },
    { value: 100 - probability },
  ]

  const teamSkills = Array.isArray(report.availableSkills) ? report.availableSkills : []
  const requiredSkills = Array.isArray(report.requiredSkills) ? report.requiredSkills : []
  const skillMatch = requiredSkills.length > 0
    ? Math.round((teamSkills.length / requiredSkills.length) * 100)
    : 0

  const skillGaugeData = [
    { value: skillMatch },
    { value: 100 - skillMatch },
  ]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between pb-1 border-b border-gray-200/80">
        <span className="text-xs font-semibold text-gray-500">Project Risk Level</span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow-xs ${config.badge}`}>
          <Icon className="w-3.5 h-3.5" />
          {report.riskLevel || 'Unknown'}
        </span>
      </div>

      {/* Side-by-Side Gauges: Risk Score & Skill Match */}
      <div className="grid grid-cols-2 gap-2 items-center pt-0.5">
        {/* Risk Score */}
        <div className="flex flex-col items-center justify-center p-1.5 bg-slate-50/60 rounded-xl border border-slate-100">
          <div className="relative w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={40}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={probability > 60 ? '#ef4444' : probability > 30 ? '#f59e0b' : '#10b981'} />
                  <Cell fill="#e2e8f0" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-extrabold text-gray-900">{probability}%</span>
              <span className="text-[9px] font-semibold text-gray-400">Risk Score</span>
            </div>
          </div>
        </div>

        {/* Skill Match */}
        <div className="flex flex-col items-center justify-center p-1.5 bg-slate-50/60 rounded-xl border border-slate-100">
          <div className="relative w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={skillGaugeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={40}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#0d9488" />
                  <Cell fill="#e2e8f0" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-extrabold text-gray-900">{skillMatch}%</span>
              <span className="text-[9px] font-semibold text-gray-400">Skill Match</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RiskSummary
