import { useMemo, useState } from 'react'
import { Lightbulb, Brain, Users, AlertTriangle, Target, CheckCircle2, XCircle, X } from 'lucide-react'
export const cleanText = (text) => {
  if (!text) return ''
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim()
}
const isTableSeparator = (line) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim())
const isTableRow = (line) => line.trim().startsWith('|') && line.trim().endsWith('|')
const isHorizontalRule = (line) => /^\s*[-*_]{3,}\s*$/.test(line.trim())
// Only treat as a heading if it's a markdown heading OR a top-level numbered section title
// (short title-like text, not a full sentence with verbs/punctuation mid-line)
const isHeading = (line) => {
  const t = line.trim()
  if (/^#{1,6}\s+/.test(t)) return true
  // Numbered section heading: e.g. "4. Recommended Team Structure" — must be short, title-case, no period mid-text
  const numMatch = t.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?$/)
  if (numMatch) {
    const title = numMatch[1].trim()
    // It's a heading if: short (under 60 chars), doesn't end with period, and starts uppercase
    if (title.length < 60 && !/\.$/.test(title) && /^[A-Z]/.test(title) && !/^(Complete|Deploy|Begin|Plan|Deliver|Build|Implement|Create|Set|Use|Add|Remove|Update)\s/i.test(title)) {
      return true
    }
  }
  return false
}
function parseTableRow(line) {
  return line
    .split('|')
    .map(cell => cleanText(cell))
    .filter((cell, idx, arr) => !(idx === 0 && cell === '') && !(idx === arr.length - 1 && cell === ''))
}
export function parseSections(text) {
  if (!text) return []
  const lines = String(text).split(/\r?\n/)
  const sections = []
  let current = { title: '', items: [] }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    // Skip empty lines and horizontal rules
    if (!trimmed || isHorizontalRule(trimmed)) {
      i++
      continue
    }
    // Detect heading
    if (isHeading(trimmed)) {
      const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/)
      if (headingMatch) {
        if (current.title || current.items.length > 0) {
          sections.push(current)
        }
        current = { title: cleanText(headingMatch[1]), items: [] }
        i++
        continue
      }
    }
    // Detect table (header row followed by separator)
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(trimmed)
      i += 2 // skip header and separator
      const rows = []
      while (i < lines.length && isTableRow(lines[i].trim())) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      current.items.push({ type: 'table', headers, rows })
      continue
    }
    // Detect bullet points
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/)
    if (bulletMatch) {
      current.items.push({ type: 'bullet', text: cleanText(bulletMatch[1]) })
      i++
      continue
    }
    // Detect numbered items
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (numberedMatch) {
      current.items.push({ type: 'bullet', text: cleanText(numberedMatch[1]) })
      i++
      continue
    }
    // Detect labeled line (e.g., "Confidence Level: Low")
    const labelMatch = trimmed.match(/^([A-Za-z\s]+):\s*(.+)$/)
    if (labelMatch && labelMatch[1].length < 40) {
      current.items.push({ type: 'label', label: cleanText(labelMatch[1]), value: cleanText(labelMatch[2]) })
      i++
      continue
    }
    // Regular text
    const cleaned = cleanText(trimmed)
    if (cleaned) {
      current.items.push({ type: 'text', text: cleaned })
    }
    i++
  }
  if (current.title || current.items.length > 0) {
    sections.push(current)
  }
  return sections
}
export function getSectionIcon(title) {
  const lower = (title || '').toLowerCase()
  if (lower.includes('team structure') || lower.includes('team composition')) return Users
  if (lower.includes('skill gap') || lower.includes('skills')) return Target
  if (lower.includes('risk') || lower.includes('warning') || lower.includes('concern')) return AlertTriangle
  if (lower.includes('confidence') || lower.includes('delivery')) return CheckCircle2
  if (lower.includes('recommendation') || lower.includes('action') || lower.includes('mitigation')) return Lightbulb
  return Brain
}
export function SkillGapTable({ headers, rows, isSkillGap }) {
  // For skill gap tables, only show rows where the skill is actually missing
  const filteredRows = isSkillGap
    ? rows.filter((row) => {
        const availableIdx = headers.findIndex(h => h.toLowerCase() === 'available')
        const missingIdx = headers.findIndex(h => h.toLowerCase() === 'missing')
        if (missingIdx >= 0 && row[missingIdx]) return row[missingIdx].toLowerCase() === 'yes'
        if (availableIdx >= 0 && row[availableIdx]) return row[availableIdx].toLowerCase() === 'no'
        return true
      })
    : rows
  if (filteredRows.length === 0) {
    return (
      <div className="mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-sm text-emerald-700 font-medium">
        All required skills are covered by the team.
      </div>
    )
  }
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mt-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                {row.map((cell, ci) => {
                  // Style "Yes"/"No" and "Missing"/"Covered" cells
                  const lower = cell.toLowerCase()
                  let cellContent = cell
                  if (lower === 'yes' && headers[ci]?.toLowerCase() === 'available') {
                    cellContent = (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                      </span>
                    )
                  } else if (lower === 'no' && headers[ci]?.toLowerCase() === 'available') {
                    cellContent = (
                      <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                        <XCircle className="w-3.5 h-3.5" /> No
                      </span>
                    )
                  } else if (lower === 'yes' && headers[ci]?.toLowerCase() === 'missing') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                        Missing
                      </span>
                    )
                  } else if (lower === 'no' && headers[ci]?.toLowerCase() === 'missing') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        Covered
                      </span>
                    )
                  } else if (lower === 'covered' && headers[ci]?.toLowerCase() === 'impact') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        Covered
                      </span>
                    )
                  } else if (lower === 'critical gap' && headers[ci]?.toLowerCase() === 'impact') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                        Critical Gap
                      </span>
                    )
                  } else if (ci === 0) {
                    // First column (skill/role name) - bold
                    cellContent = <span className="font-medium text-gray-900">{cell}</span>
                  }
                  return (
                    <td key={ci} className="px-4 py-3 text-gray-600">
                      {cellContent}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
function buildSkillGapTable(requiredSkills, availableSkills, missingSkills) {
  const required = Array.isArray(requiredSkills) ? requiredSkills : []
  const available = new Set((Array.isArray(availableSkills) ? availableSkills : []).map(s => String(s).toLowerCase().trim()))
  const missing = new Set((Array.isArray(missingSkills) ? missingSkills : []).map(s => String(s).toLowerCase().trim()))
  if (required.length === 0) return null
  const headers = ['Required Skill', 'Available', 'Impact']
  const rows = required.map(skill => {
    const key = String(skill).toLowerCase().trim()
    const isAvailable = available.has(key)
    const isMissing = missing.has(key)
    const status = isAvailable ? 'Yes' : (isMissing ? 'No' : 'No')
    const impact = isAvailable ? 'Covered' : 'Critical Gap'
    return [cleanText(skill), status, impact]
  })
  return { type: 'table', headers, rows }
}
const MAJOR_KEYWORDS = ['risk assessment', 'skill gap', 'capacity', 'team structure', 'confidence', 'delivery', 'action plan', 'executive action', 'overview']
function mergeActionPlanSections(sections) {
  const result = []
  let mergeInto = null
  for (const section of sections) {
    const lower = (section.title || '').toLowerCase()
    const isActionPlan = lower.includes('action plan') || lower.includes('executive action')
    if (isActionPlan) {
      mergeInto = { title: section.title, items: [...section.items] }
      result.push(mergeInto)
    } else if (mergeInto) {
      // Once inside action plan, merge ALL remaining sections into it
      if (section.title) {
        mergeInto.items.push({ type: 'subheading', text: section.title })
      }
      mergeInto.items.push(...section.items)
    } else {
      result.push(section)
    }
  }
  return result
}
function ReasoningSection({ reasoning, recommendedTeamStructure, requiredSkills, availableSkills, missingSkills }) {
  const sections = useMemo(() => mergeActionPlanSections(parseSections(reasoning)), [reasoning])
  const teamStructureSections = useMemo(() => parseSections(recommendedTeamStructure), [recommendedTeamStructure])
  const [activeTab, setActiveTab] = useState('summary')
  if (!reasoning && !recommendedTeamStructure) {
    return null
  }
  const filtered = sections.filter((section) => {
    const lower = (section.title || '').toLowerCase()
    if (lower.includes('executive summary') || lower.includes('summary')) return true
    if (lower.includes('capacity')) return true
    if (lower.includes('skill gap')) return true
    if (lower.includes('action plan')) return true
    if (lower.includes('team structure') || lower.includes('recommended team')) return true
    return false
  })
  const categorize = (section) => {
    const lower = (section.title || '').toLowerCase()
    if (lower.includes('executive summary') || lower.includes('summary')) return 'summary'
    if (lower.includes('capacity')) return 'capacity'
    if (lower.includes('skill gap')) return 'skillgap'
    if (lower.includes('action plan')) return 'actionplan'
    if (lower.includes('team structure') || lower.includes('recommended team')) return 'teamstructure'
    return 'other'
  }
  const summarySection = filtered.find(s => categorize(s) === 'summary')
  const capacitySection = filtered.find(s => categorize(s) === 'capacity')
  const skillGapSection = filtered.find(s => categorize(s) === 'skillgap')
  const actionPlanSection = filtered.find(s => categorize(s) === 'actionplan')
  const teamStructureFromReasoning = filtered.find(s => categorize(s) === 'teamstructure')
  const hasTeamStructure = recommendedTeamStructure || teamStructureFromReasoning
  const buttonConfigs = [
    { key: 'summary', label: 'Executive Summary', icon: Brain, color: 'from-slate-500 to-gray-600', section: summarySection || { title: 'Summary', items: [] } },
    { key: 'capacity', label: 'Capacity vs Scope', icon: Target, color: 'from-emerald-500 to-teal-600', section: capacitySection },
    { key: 'skillgap', label: 'Skill Gap Analysis', icon: AlertTriangle, color: 'from-amber-500 to-orange-600', section: skillGapSection },
    { key: 'actionplan', label: 'Executive Action Plan', icon: Lightbulb, color: 'from-green-500 to-emerald-600', section: actionPlanSection },
    { key: 'teamstructure', label: 'Team Structure', icon: Users, color: 'from-teal-500 to-cyan-600', section: hasTeamStructure ? { title: 'Recommended Team Structure' } : null },
  ].filter(b => b.section)
  const renderModalContent = (key) => {
    if (key === 'skillgap') {
      const required = Array.isArray(requiredSkills) ? requiredSkills : []
      const avail = Array.isArray(availableSkills) ? availableSkills : []
      const miss = Array.isArray(missingSkills) ? missingSkills : []
      const strip = (s) => String(s || '').replace(/\*+/g, '').trim()
      return (
        <div className="space-y-3 text-sm">
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 shrink-0">Required Skills:</span>
            <span className="text-gray-600">{required.map(s => strip(s)).join(', ')}.</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 shrink-0">Available Skills:</span>
            <span className="text-gray-600">{avail.length} identified.</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-gray-700 shrink-0">Missing Skills:</span>
            <span className="text-gray-600">
              {miss.length} of {required.length} required skills
              {avail.length > 0 ? ` (${avail.map(s => strip(s).toLowerCase()).join(', ')} covered by team)` : ''}
              {' '}are missing.
            </span>
          </div>
          {miss.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="font-semibold text-amber-800">Impact: </span>
              <span className="text-amber-800">
                The lack of skills will lead to delays, poor code quality, and potential project failure unless addressed immediately.
              </span>
            </div>
          )}
        </div>
      )
    }
    if (key === 'teamstructure') {
      const sectionsToRender = teamStructureSections.length > 0 ? teamStructureSections : (teamStructureFromReasoning ? [teamStructureFromReasoning] : [])
      if (sectionsToRender.length === 0) return <p className="text-sm text-gray-500">No team structure data available.</p>
      return (
        <div className="space-y-3">
          {sectionsToRender.map((section, idx) => (
            <div key={idx}>
              {section.title && <p className="text-sm font-semibold text-teal-800 mb-2">{section.title}</p>}
              {section.items.map((item, i) => {
                if (item.type === 'table') {
                  return (
                    <div key={i} className="border border-gray-200 rounded-xl overflow-hidden mt-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-teal-50 border-b border-teal-200">
                            {item.headers.map((h, hi) => (
                              <th key={hi} className="px-4 py-2.5 text-left text-xs font-semibold text-teal-700 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {item.rows.map((row, ri) => (
                            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              {row.map((cell, ci) => (
                                <td key={ci} className={`px-4 py-3 ${ci === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
                if (item.type === 'bullet') {
                  return (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0"></span>
                      <span>{item.text}</span>
                    </div>
                  )
                }
                if (item.type === 'label') {
                  return (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-semibold text-gray-700">{item.label}:</span>
                      <span className="text-gray-600">{item.value}</span>
                    </div>
                  )
                }
                return <p key={i} className="text-sm text-gray-600">{item.text}</p>
              })}
            </div>
          ))}
        </div>
      )
    }
    // Generic section rendering
    const section = filtered.find(s => categorize(s) === key)
    if (!section) return null
    return (
      <div className="space-y-2">
        {section.items.map((item, i) => {
          if (item.type === 'table') {
            return <SkillGapTable key={i} headers={item.headers} rows={item.rows} isSkillGap={false} />
          }
          if (item.type === 'bullet') {
            return (
              <div key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0"></span>
                <span className="leading-relaxed">{item.text}</span>
              </div>
            )
          }
          if (item.type === 'subheading') {
            return <p key={i} className="text-sm font-semibold text-gray-800 mt-3 mb-1">{item.text}</p>
          }
          if (item.type === 'label') {
            return (
              <div key={i} className="flex gap-2 text-sm">
                <span className="font-semibold text-gray-700">{item.label}:</span>
                <span className="text-gray-600">{item.value}</span>
              </div>
            )
          }
          return <p key={i} className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
        })}
      </div>
    )
  }
  // Resolve current active tab (fallback if not in list)
  const currentTab = buttonConfigs.some(b => b.key === activeTab)
    ? activeTab
    : (buttonConfigs[0]?.key || null)
  return (
    <div className="space-y-6">
      {/* Horizontal Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200/80 pb-3">
        {buttonConfigs.map(({ key, label, icon: Icon, color }) => {
          const isActive = currentTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'border-teal-500 bg-teal-50/50 text-teal-800 shadow-2xs'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <span>{label}</span>
            </button>
          )
        })}
      </div>
      {/* Tab Content Panel */}
      {currentTab && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-2xs animate-fade-in">
          {renderModalContent(currentTab)}
        </div>
      )}
    </div>
  )
}
export default ReasoningSection
