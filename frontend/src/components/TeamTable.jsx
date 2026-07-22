import { User, Briefcase } from 'lucide-react'
function TeamTable({ teamData }) {
  if (!teamData || teamData.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          No team data available.
        </p>
      </div>
    )
  }
  const allSkills = teamData.flatMap(m => m.skills || [])
  const skillCounts = {}
  allSkills.forEach(skill => { skillCounts[skill] = (skillCounts[skill] || 0) + 1 })
  const topSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const getMaturityBadge = (exp) => {
    const years = Number(exp) || 0
    if (years > 5) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
    if (years > 2) return 'text-amber-700 bg-amber-50 border-amber-200'
    return 'text-red-700 bg-red-50 border-red-200'
  }
  return (
    <div className="space-y-6">
      {/* Top Skills Summary */}
      {topSkills.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Top Team Technologies</h4>
          <div className="flex flex-wrap gap-2">
            {topSkills.map(([skill, count], idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-1.5 px-3 py-1 bg-teal-50/50 text-teal-800 rounded-lg border border-teal-100/80 text-xs font-semibold shadow-2xs"
              >
                <span>{skill}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                <span className="text-teal-600/90">{count} member{count === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Team Roster Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Member</th>
                <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Experience</th>
                <th className="px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Skills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teamData.map((member, idx) => {
                const name = member.name?.trim() || `Developer ${idx + 1}`
                const role = member.role?.trim() || 'Software Developer'
                const exp = member.experience || 0
                const skills = member.skills || []
                return (
                  <tr key={member.id || idx} className="hover:bg-gray-50/40 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500/10 to-emerald-500/10 flex items-center justify-center border border-teal-500/10 shrink-0">
                          <User className="w-4 h-4 text-teal-600" />
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{name}</div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-600">{role}</span>
                      </div>
                    </td>
                    {/* Experience */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${getMaturityBadge(exp)}`}>
                          {exp} yr{Number(exp) === 1 ? '' : 's'}
                        </span>
                      </div>
                    </td>
                    {/* Skills */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs sm:max-w-md">
                        {skills.map((s, si) => (
                          <span 
                            key={si} 
                            className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200"
                          >
                            {s}
                          </span>
                        ))}
                        {skills.length === 0 && (
                          <span className="text-xs text-gray-400 italic">No skills listed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
export default TeamTable
