import { Users, Clock, Award } from 'lucide-react'
function TeamAnalysis({ report }) {
  const teamRows = Array.isArray(report.teamData) ? report.teamData : []
  const derivedSize = teamRows.length
  const derivedAvgExperience = derivedSize
    ? (teamRows.reduce((sum, member) => sum + (Number(member.experience) || 0), 0) / derivedSize)
    : 0
  const teamSize = derivedSize || Number(report.developers) || 0
  const avgExperience = derivedSize ? derivedAvgExperience : (Number(report.avgExperience) || 0)
  const getMaturityLevel = (exp) => {
    if (exp > 5) return { label: 'Senior', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
    if (exp > 2) return { label: 'Mid-level', color: 'text-amber-600 bg-amber-50 border-amber-200' }
    return { label: 'Junior', color: 'text-red-600 bg-red-50 border-red-200' }
  }
  const maturity = getMaturityLevel(avgExperience)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center p-4 bg-white border border-gray-100 rounded-xl shadow-xs transition-transform hover:-translate-y-0.5 duration-200">
          <Users className="w-6 h-6 text-teal-600 mb-2" />
          <span className="text-2xl font-extrabold text-gray-900">{teamSize}</span>
          <span className="text-xs font-medium text-gray-500 mt-1">Members</span>
        </div>
        <div className="flex flex-col items-center p-4 bg-white border border-gray-100 rounded-xl shadow-xs transition-transform hover:-translate-y-0.5 duration-200">
          <Clock className="w-6 h-6 text-blue-600 mb-2" />
          <span className="text-2xl font-extrabold text-gray-900">{teamSize ? parseFloat(Number(avgExperience).toFixed(1)) : '--'}</span>
          <span className="text-xs font-medium text-gray-500 mt-1">Avg Experience</span>
        </div>
        <div className="flex flex-col items-center p-4 bg-white border border-gray-100 rounded-xl shadow-xs transition-transform hover:-translate-y-0.5 duration-200">
          <Award className="w-6 h-6 text-purple-600 mb-2" />
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${maturity.color} shadow-2xs`}>
            {maturity.label}
          </span>
          <span className="text-xs font-medium text-gray-500 mt-2">Maturity</span>
        </div>
      </div>
      {teamSize > 0 && (
        <div className="p-4 bg-gradient-to-r from-teal-50/50 to-emerald-50/50 rounded-xl border border-teal-100/80 shadow-2xs">
          <p className="text-sm text-teal-800 leading-relaxed">
            The team consists of <strong className="font-semibold">{teamSize} developer{teamSize === 1 ? '' : 's'}</strong> with an average of{' '}
            <strong className="font-semibold">{parseFloat(Number(avgExperience).toFixed(1))} years</strong> of experience.
          </p>
        </div>
      )}
    </div>
  )
}
export default TeamAnalysis
