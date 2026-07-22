import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

const SKILL_COLORS = {
  python: 'bg-blue-100 text-blue-700 border-blue-200',
  javascript: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  typescript: 'bg-blue-100 text-blue-700 border-blue-200',
  react: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'node.js': 'bg-green-100 text-green-700 border-green-200',
  aws: 'bg-orange-100 text-orange-700 border-orange-200',
  docker: 'bg-sky-100 text-sky-700 border-sky-200',
  kubernetes: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  mongodb: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  redis: 'bg-red-100 text-red-700 border-red-200',
  graphql: 'bg-pink-100 text-pink-700 border-pink-200',
  django: 'bg-green-100 text-green-800 border-green-200',
  postgresql: 'bg-slate-100 text-slate-700 border-slate-200',
}

function getSkillColor(skill) {
  const key = String(skill || '').toLowerCase().replace(/[*_`]/g, '').trim()
  return SKILL_COLORS[key] || 'bg-gray-100 text-gray-700 border-gray-200'
}

function SkillsSection({ title, skills, availableSkills }) {
  const isMissing = title.includes('Missing')
  const isAvailableSection = title.includes('Available')
  const stripStars = (s) => String(s || '').replace(/\*+/g, '').trim()
  const available = (availableSkills || []).map(s => stripStars(s).toLowerCase())

  const labelText = isMissing 
    ? 'Total Critical Gaps' 
    : (isAvailableSection ? 'Total Available Skills' : 'Total Required Skills')

  const badgeColor = isMissing 
    ? 'bg-red-50 text-red-700 border-red-200' 
    : (isAvailableSection ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-teal-50 text-teal-700 border-teal-200')

  return (
    <div className="space-y-3">
      {skills && skills.length > 0 && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-200/80">
          <span className="text-xs font-medium text-gray-500">{labelText}</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${badgeColor}`}>
            {skills.length} {isMissing ? 'gaps' : 'skills'}
          </span>
        </div>
      )}
      {(!skills || !skills.length) ? (
        <div className="p-4 text-center bg-white border border-gray-100 rounded-xl shadow-2xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5" />
          <p className="text-xs font-medium text-gray-500">No {title.toLowerCase()} found.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {skills.map((skill, idx) => {
            const name = stripStars(skill)
            const isAvailable = isMissing && available.includes(name.toLowerCase())
            const color = isMissing
              ? (isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs' : 'bg-red-50 text-red-700 border-red-200 shadow-2xs')
              : `${getSkillColor(skill)} shadow-2xs`
            return (
              <span
                key={idx}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${color} transition-transform hover:-translate-y-0.5 duration-200`}
              >
                {name}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SkillsSection
