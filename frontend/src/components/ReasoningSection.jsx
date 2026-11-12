import { useMemo, useState } from 'react'
import { 
  Lightbulb, Brain, Users, AlertTriangle, Target, CheckCircle2, 
  XCircle, FileText, ChevronRight, Shield, TrendingUp
} from 'lucide-react'

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

// Render formatted text supporting bold **text**
function RenderFormatted({ text, className = '' }) {
  if (!text) return null
  const str = String(text)
  const parts = str.split(/(\*\*.*?\*\*)/g)
  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={idx} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return part
      })}
    </span>
  )
}

const isTableSeparator = (line) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim())
const isTableRow = (line) => line.trim().startsWith('|') && line.trim().endsWith('|')
const isHorizontalRule = (line) => /^\s*[-*_]{3,}\s*$/.test(line.trim())

function parseTableRow(line) {
  return line
    .split('|')
    .map(cell => cleanText(cell))
    .filter((cell, idx, arr) => !(idx === 0 && cell === '') && !(idx === arr.length - 1 && cell === ''))
}

function cleanHeadingTitle(raw) {
  return raw
    .replace(/\*+/g, '')
    .replace(/^[:\s\-#\d\.\)]+/, '')
    .replace(/[:\s\-#]+$/, '')
    .trim()
}

function extractHeading(line) {
  const trimmed = line.trim()
  
  // 1. Markdown heading: # Heading, ## Heading, ### Heading
  const mdMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
  if (mdMatch) {
    return cleanHeadingTitle(mdMatch[1])
  }

  // 2. Bold heading line e.g. **1. Executive Summary**
  const boldMatch = trimmed.match(/^\*\*(?:\d+[\.\)]\s*)?([^*:]+):?\*\*\s*$/)
  if (boldMatch) {
    const title = boldMatch[1].trim()
    if (title.length > 2 && title.length < 65) {
      return cleanHeadingTitle(title)
    }
  }

  // 3. Numbered section heading e.g. "1. Executive Summary"
  const numMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/)
  if (numMatch) {
    const title = numMatch[1].replace(/\*+/g, '').trim()
    if (title.length > 2 && title.length < 65 && !/\.$/.test(title) && /^[A-Z]/.test(title)) {
      if (!/^(Complete|Deploy|Begin|Plan|Deliver|Build|Implement|Create|Set|Use|Add|Remove|Update)\s/i.test(title)) {
        return cleanHeadingTitle(title)
      }
    }
  }

  return null
}

function parseObjectToSections(obj) {
  if (!obj || typeof obj !== 'object') return []
  const sections = []
  
  for (const [key, value] of Object.entries(obj)) {
    if (!value) continue
    const title = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim()

    if (typeof value === 'string') {
      sections.push(...parseSections(value))
    } else if (Array.isArray(value)) {
      const items = value.map(item => ({
        type: 'bullet',
        text: typeof item === 'object' ? JSON.stringify(item) : String(item)
      }))
      sections.push({ title, items })
    } else if (typeof value === 'object') {
      const items = Object.entries(value).map(([k, v]) => ({
        type: 'label',
        label: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v)
      }))
      sections.push({ title, items })
    }
  }
  return sections
}

export function parseSections(text) {
  if (!text) return []
  if (typeof text === 'object') {
    return parseObjectToSections(text)
  }

  const textStr = String(text).trim()
  if (!textStr) return []

  if ((textStr.startsWith('{') && textStr.endsWith('}')) || (textStr.startsWith('[') && textStr.endsWith(']'))) {
    try {
      const parsed = JSON.parse(textStr)
      return parseObjectToSections(parsed)
    } catch {
      // Proceed as markdown
    }
  }

  const lines = textStr.split(/\r?\n/)
  const sections = []
  let current = { title: '', items: [] }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed || isHorizontalRule(trimmed)) {
      i++
      continue
    }

    const heading = extractHeading(trimmed)
    if (heading) {
      if (current.title || current.items.length > 0) {
        sections.push(current)
      }
      current = { title: heading, items: [] }
      i++
      continue
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(trimmed)
      i += 2
      const rows = []
      while (i < lines.length && isTableRow(lines[i].trim())) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      current.items.push({ type: 'table', headers, rows })
      continue
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/)
    if (bulletMatch) {
      current.items.push({ type: 'bullet', text: bulletMatch[1].trim() })
      i++
      continue
    }

    const numberedMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/)
    if (numberedMatch) {
      current.items.push({ type: 'bullet', text: numberedMatch[1].trim() })
      i++
      continue
    }

    const labelMatch = trimmed.match(/^([A-Za-z0-9\s/&_-]{2,35}):\s*(.+)$/)
    if (labelMatch && !trimmed.startsWith('http') && labelMatch[2].length < 150) {
      current.items.push({ type: 'label', label: cleanText(labelMatch[1]), value: cleanText(labelMatch[2]) })
      i++
      continue
    }

    current.items.push({ type: 'text', text: trimmed })
    i++
  }

  if (current.title || current.items.length > 0) {
    sections.push(current)
  }

  if (sections.length > 0 && !sections[0].title) {
    sections[0].title = 'Executive Summary'
  }

  return sections
}

export function getSectionIcon(title) {
  const lower = (title || '').toLowerCase()
  if (lower.includes('team structure') || lower.includes('team composition') || lower.includes('role') || lower.includes('staffing')) return Users
  if (lower.includes('skill gap') || lower.includes('skills') || lower.includes('gap')) return AlertTriangle
  if (lower.includes('capacity') || lower.includes('scope') || lower.includes('workload')) return Target
  if (lower.includes('confidence') || lower.includes('delivery') || lower.includes('metric')) return CheckCircle2
  if (lower.includes('recommendation') || lower.includes('action') || lower.includes('mitigation') || lower.includes('plan')) return Lightbulb
  if (lower.includes('risk')) return Shield
  return Brain
}

export function SkillGapTable({ headers, rows, isSkillGap }) {
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
      <div className="mt-2 p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-xs text-emerald-700 font-semibold flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>All required skills are fully covered by the team.</span>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mt-2.5 shadow-2xs bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {headers.map((h, i) => (
                <th key={i} className="px-3.5 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40 hover:bg-slate-50 transition-colors'}>
                {row.map((cell, ci) => {
                  const lower = cell.toLowerCase().trim()
                  let cellContent = <RenderFormatted text={cell} />

                  if (lower === 'yes' && headers[ci]?.toLowerCase() === 'available') {
                    cellContent = (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Yes
                      </span>
                    )
                  } else if (lower === 'no' && headers[ci]?.toLowerCase() === 'available') {
                    cellContent = (
                      <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                        <XCircle className="w-3.5 h-3.5 text-red-500" /> No
                      </span>
                    )
                  } else if (lower === 'yes' && headers[ci]?.toLowerCase() === 'missing') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        Missing
                      </span>
                    )
                  } else if (lower === 'no' && headers[ci]?.toLowerCase() === 'missing') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Covered
                      </span>
                    )
                  } else if (lower === 'covered' && headers[ci]?.toLowerCase() === 'impact') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Covered
                      </span>
                    )
                  } else if ((lower === 'critical gap' || lower === 'critical') && headers[ci]?.toLowerCase() === 'impact') {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                        Critical Gap
                      </span>
                    )
                  } else if (ci === 0) {
                    cellContent = <span className="font-bold text-slate-900">{cell}</span>
                  }

                  return (
                    <td key={ci} className="px-3.5 py-2.5 text-slate-700">
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

// Exactly 6 Standard Categories (Ending at Key Risk Factors)
const ALLOWED_CATEGORIES = [
  { 
    key: 'summary', 
    label: 'Executive Summary', 
    icon: Brain, 
    color: 'from-slate-600 to-gray-700',
    match: (t) => t.includes('summary') || t.includes('overview') || t.includes('finding') || t.includes('assessment') || t.includes('intro')
  },
  { 
    key: 'capacity', 
    label: 'Capacity vs Scope', 
    icon: Target, 
    color: 'from-teal-600 to-emerald-700',
    match: (t) => t.includes('capacity') || t.includes('scope') || t.includes('workload') || t.includes('experience') || t.includes('resource')
  },
  { 
    key: 'skillgap', 
    label: 'Skill Gap Analysis', 
    icon: AlertTriangle, 
    color: 'from-amber-600 to-orange-600',
    match: (t) => t.includes('skill gap') || t.includes('skills') || t.includes('missing') || t.includes('gap') || t.includes('technolog')
  },
  { 
    key: 'teamstructure', 
    label: 'Recommended Team Structure', 
    icon: Users, 
    color: 'from-indigo-600 to-blue-700',
    match: (t) => t.includes('team structure') || t.includes('recommended team') || t.includes('role') || t.includes('staffing') || t.includes('composition')
  },
  { 
    key: 'actionplan', 
    label: 'Strategic Action Plan', 
    icon: Lightbulb, 
    color: 'from-cyan-600 to-teal-700',
    match: (t) => t.includes('action plan') || t.includes('action') || t.includes('recommendation') || t.includes('mitigation') || t.includes('next steps')
  },
  { 
    key: 'keyriskfactors', 
    label: 'Key Risk Factors', 
    icon: Shield, 
    color: 'from-teal-500 to-emerald-600',
    match: (t) => t.includes('key risk') || t.includes('risk factor') || t.includes('risk analysis') || t.includes('risk overview') || t.includes('risks')
  },
]

function generateRecommendedRoles(missingSkillsList) {
  const missing = Array.isArray(missingSkillsList) ? missingSkillsList : []
  if (missing.length === 0) return []

  const roles = {}
  missing.forEach(skill => {
    const sl = String(skill).toLowerCase().trim()
    if (anyMatch(sl, ["react", "angular", "vue", "css", "html", "frontend", "typescript", "tailwind", "ui"])) {
      roles["Senior Frontend Developer"] = roles["Senior Frontend Developer"] || []
      roles["Senior Frontend Developer"].push(skill)
    } else if (anyMatch(sl, ["node", "django", "spring", "flask", "express", "api", "rest", "graphql", "python", "java", "backend"])) {
      roles["Senior Backend Developer"] = roles["Senior Backend Developer"] || []
      roles["Senior Backend Developer"].push(skill)
    } else if (anyMatch(sl, ["postgres", "mysql", "mongo", "redis", "elasticsearch", "database", "sql", "db"])) {
      roles["Database Engineer"] = roles["Database Engineer"] || []
      roles["Database Engineer"].push(skill)
    } else if (anyMatch(sl, ["docker", "kubernetes", "terraform", "aws", "azure", "cloud", "devops", "ci", "cd", "gcp"])) {
      roles["DevOps / Cloud Engineer"] = roles["DevOps / Cloud Engineer"] || []
      roles["DevOps / Cloud Engineer"].push(skill)
    } else if (anyMatch(sl, ["oauth", "jwt", "security", "encrypt", "auth", "access"])) {
      roles["Security Engineer"] = roles["Security Engineer"] || []
      roles["Security Engineer"].push(skill)
    } else if (anyMatch(sl, ["rabbitmq", "kafka", "queue", "messaging", "pubsub"])) {
      roles["Integration Specialist"] = roles["Integration Specialist"] || []
      roles["Integration Specialist"].push(skill)
    } else {
      roles["Senior Full-Stack Developer"] = roles["Senior Full-Stack Developer"] || []
      roles["Senior Full-Stack Developer"].push(skill)
    }
  })

  return Object.entries(roles).map(([roleTitle, skills]) => ({
    role: roleTitle,
    skills: skills.join(', '),
    priority: 'High Priority',
    count: '1-2 Specialists'
  }))
}

function anyMatch(str, keywords) {
  return keywords.some(k => str.includes(k))
}

function ReasoningSection({ reasoning, recommendedTeamStructure, requiredSkills, availableSkills, missingSkills }) {
  const sections = useMemo(() => parseSections(reasoning), [reasoning])
  const teamStructureSections = useMemo(() => parseSections(recommendedTeamStructure), [recommendedTeamStructure])
  
  const [activeTab, setActiveTab] = useState('summary')
  const [viewMode, setViewMode] = useState('tabbed')

  // Tab Navigation Configs — ONLY UP TO KEY RISK FACTORS (DISCARD FURTHER TABS)
  const tabConfigs = useMemo(() => {
    const map = new Map()

    // Initialize only the allowed categories (1 to 6)
    ALLOWED_CATEGORIES.forEach(def => {
      map.set(def.key, {
        key: def.key,
        label: def.label,
        icon: def.icon,
        color: def.color,
        sections: []
      })
    })

    // Populate parsed sections strictly into the allowed categories up to Key Risk Factors
    sections.forEach((sec) => {
      const lower = (sec.title || '').toLowerCase()
      let matchedDef = ALLOWED_CATEGORIES.find(def => def.match(lower))
      if (matchedDef) {
        map.get(matchedDef.key).sections.push(sec)
      }
    })

    // Assign teamStructureSections if passed
    if (teamStructureSections.length > 0) {
      map.get('teamstructure').sections.push(...teamStructureSections)
    }

    return Array.from(map.values())
  }, [sections, teamStructureSections])

  const currentTabKey = tabConfigs.some(t => t.key === activeTab)
    ? activeTab
    : (tabConfigs[0]?.key || 'summary')

  const renderSectionItems = (items) => {
    if (!items || items.length === 0) return null
    return (
      <div className="space-y-2.5">
        {items.map((item, i) => {
          if (item.type === 'table') {
            return <SkillGapTable key={i} headers={item.headers} rows={item.rows} isSkillGap={false} />
          }

          if (item.type === 'bullet') {
            return (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs hover:border-slate-200 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                <div className="leading-relaxed flex-1">
                  <RenderFormatted text={item.text} />
                </div>
              </div>
            )
          }

          if (item.type === 'label') {
            return (
              <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs">
                <span className="font-bold text-slate-700">{item.label}</span>
                <span className="font-medium text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                  <RenderFormatted text={item.value} />
                </span>
              </div>
            )
          }

          return (
            <p key={i} className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
              <RenderFormatted text={item.text} />
            </p>
          )
        })}
      </div>
    )
  }

  const renderTabContent = (configKey) => {
    const required = Array.isArray(requiredSkills) ? requiredSkills : []
    const avail = Array.isArray(availableSkills) ? availableSkills : []
    const miss = Array.isArray(missingSkills) ? missingSkills : []
    const strip = (s) => String(s || '').replace(/\*+/g, '').trim()

    // 1. Executive Summary Tab
    if (configKey === 'summary') {
      const summarySecs = tabConfigs.find(t => t.key === 'summary')?.sections || []
      return (
        <div className="space-y-4">
          <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Executive Summary</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                AI Risk Assessment
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              Overall project risk analysis evaluating team capacity, technical skill coverage, timeline feasibility, and key execution bottlenecks.
            </p>
          </div>

          {summarySecs.length > 0 ? (
            summarySecs.map((sec, idx) => (
              <div key={idx} className="space-y-2">
                {sec.title && <h5 className="text-xs font-bold text-slate-800">{sec.title}</h5>}
                {renderSectionItems(sec.items)}
              </div>
            ))
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed shadow-2xs">
                The analysis indicates key risk factors regarding project execution. The current team covers <strong className="text-slate-900">{avail.length} of {required.length}</strong> required technical skills ({required.length ? Math.round((avail.length / required.length) * 100) : 0}% skill coverage). There are <strong className="text-red-600">{miss.length} critical skill gaps</strong> that present delivery risks unless mitigated through targeted staffing or specialist consulting.
              </div>
            </div>
          )}
        </div>
      )
    }

    // 2. Capacity vs Scope Tab
    if (configKey === 'capacity') {
      const capacitySecs = tabConfigs.find(t => t.key === 'capacity')?.sections || []
      const coverageRate = required.length ? Math.round((avail.length / required.length) * 100) : 0
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 bg-teal-50/80 rounded-xl border border-teal-200/80">
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Skill Coverage</span>
              <div className="text-lg font-extrabold text-teal-900 mt-0.5">{coverageRate}%</div>
              <span className="text-[11px] text-teal-700">{avail.length} of {required.length} skills covered</span>
            </div>
            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/80">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Team Capacity</span>
              <div className="text-lg font-extrabold text-emerald-900 mt-0.5">{avail.length} Active Skills</div>
              <span className="text-[11px] text-emerald-700">Team member profile capabilities</span>
            </div>
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Uncovered Scope</span>
              <div className="text-lg font-extrabold text-amber-900 mt-0.5">{miss.length} Gaps</div>
              <span className="text-[11px] text-amber-700">Required technologies missing</span>
            </div>
          </div>

          {capacitySecs.length > 0 ? (
            capacitySecs.map((sec, idx) => (
              <div key={idx} className="space-y-2">
                {sec.title && <h5 className="text-xs font-bold text-slate-800">{sec.title}</h5>}
                {renderSectionItems(sec.items)}
              </div>
            ))
          ) : (
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed shadow-2xs space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-teal-600" />
                Capacity & Scope Alignment
              </div>
              <p>
                The assigned development team has an average capacity covering {coverageRate}% of required project domains. To ensure scope completion within target deadlines, additional development bandwidth or technical expertise is recommended in unassigned technology stack areas.
              </p>
            </div>
          )}
        </div>
      )
    }

    // 3. Skill Gap Analysis Tab
    if (configKey === 'skillgap') {
      const gapSecs = tabConfigs.find(t => t.key === 'skillgap')?.sections || []
      const tableHeaders = ['Required Technology / Skill', 'Current Status', 'Risk Impact']
      const tableRows = [
        ...miss.map(s => [strip(s), 'Missing', 'Critical Gap']),
        ...avail.map(s => [strip(s), 'Available', 'Covered'])
      ]

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="p-3 bg-cyan-50/80 rounded-xl border border-cyan-200/80">
              <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider">Total Required Skills</div>
              <div className="text-lg font-extrabold text-cyan-900 mt-0.5">{required.length}</div>
              <div className="text-[11px] text-cyan-700 mt-0.5 line-clamp-1">{required.map(s => strip(s)).join(', ')}</div>
            </div>

            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/80">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Covered by Team</div>
              <div className="text-lg font-extrabold text-emerald-900 mt-0.5">{avail.length}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5 line-clamp-1">{avail.map(s => strip(s)).join(', ')}</div>
            </div>

            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80">
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Missing Skill Gaps</div>
              <div className="text-lg font-extrabold text-amber-900 mt-0.5">{miss.length}</div>
              <div className="text-[11px] text-amber-700 mt-0.5 line-clamp-1">{miss.length > 0 ? miss.map(s => strip(s)).join(', ') : 'None missing'}</div>
            </div>
          </div>

          {miss.length > 0 && (
            <div className="p-3.5 bg-red-50/80 rounded-xl border border-red-200/80 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 leading-relaxed">
                <span className="font-bold">Critical Skill Gap Notice: </span>
                {miss.length} required technology {miss.length === 1 ? 'skill is' : 'skills are'} missing ({miss.map(s => strip(s)).join(', ')}). Immediate onboarding or specialized contracting is recommended to avoid timeline delays.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Skill Gap Matrix
            </h5>
            <SkillGapTable headers={tableHeaders} rows={tableRows} isSkillGap={false} />
          </div>

          {gapSecs.map((sec, idx) => (
            <div key={idx} className="space-y-2 pt-2">
              {sec.title && <h5 className="text-xs font-bold text-slate-800">{sec.title}</h5>}
              {renderSectionItems(sec.items)}
            </div>
          ))}
        </div>
      )
    }

    // 4. Recommended Team Structure Tab
    if (configKey === 'teamstructure') {
      const teamSecs = tabConfigs.find(t => t.key === 'teamstructure')?.sections || []
      const recommendedRoles = generateRecommendedRoles(miss)

      return (
        <div className="space-y-4">
          <div className="p-3.5 bg-indigo-50/80 rounded-xl border border-indigo-200/80 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Recommended Team Structure & Roles</span>
            </div>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Targeted team role additions formulated to cover all identified technology skill gaps and optimize project execution.
            </p>
          </div>

          {recommendedRoles.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3.5 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Recommended Role</th>
                      <th className="px-3.5 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Key Required Skills</th>
                      <th className="px-3.5 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Priority</th>
                      <th className="px-3.5 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">Staffing Need</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recommendedRoles.map((r, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40 hover:bg-slate-50'}>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">{r.role}</td>
                        <td className="px-3.5 py-2.5 text-slate-700">{r.skills}</td>
                        <td className="px-3.5 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {r.priority}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-medium">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Current team composition covers all required engineering roles. No additional key roles required.</span>
            </div>
          )}

          {teamSecs.map((sec, idx) => (
            <div key={idx} className="space-y-2 pt-2">
              {sec.title && <h5 className="text-xs font-bold text-slate-800">{sec.title}</h5>}
              {renderSectionItems(sec.items)}
            </div>
          ))}
        </div>
      )
    }

    // 5. Strategic Action Plan Tab
    if (configKey === 'actionplan') {
      const actionSecs = tabConfigs.find(t => t.key === 'actionplan')?.sections || []

      return (
        <div className="space-y-4">
          <div className="p-3.5 bg-cyan-50/80 rounded-xl border border-cyan-200/80 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-900">
              <Lightbulb className="w-4 h-4 text-cyan-600" />
              <span>Executive Risk Mitigation & Strategic Action Plan</span>
            </div>
            <p className="text-xs text-cyan-700 leading-relaxed">
              Step-by-step roadmap to eliminate skill gaps, optimize team velocity, and safeguard delivery milestones.
            </p>
          </div>

          {actionSecs.length > 0 ? (
            actionSecs.map((sec, idx) => (
              <div key={idx} className="space-y-2">
                {sec.title && <h5 className="text-xs font-bold text-slate-800">{sec.title}</h5>}
                {renderSectionItems(sec.items)}
              </div>
            ))
          ) : (
            <div className="space-y-2.5">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                  <span className="w-5 h-5 rounded-md bg-red-100 text-red-700 flex items-center justify-center text-[11px]">1</span>
                  <span>Immediate (Days 1–7): Address Critical Skill Gaps</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Onboard contract specialists or accelerate hiring for key missing technologies: {miss.length > 0 ? miss.map(s => strip(s)).join(', ') : 'Required project tools'}.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                  <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[11px]">2</span>
                  <span>Short-Term (Weeks 1–4): Team Capacity & Mentorship Alignment</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Pair senior engineers with team members for key integrations and establish clear code review guidelines for missing tech stack areas.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-700">
                  <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center text-[11px]">3</span>
                  <span>Milestone Review (Weeks 4–8): Automated Quality Gates</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Implement automated CI/CD testing pipelines and conduct weekly risk reviews to measure velocity and quality metrics.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">4</span>
                  <span>Strategic: Knowledge Transfer & Cross-Training</span>
                </div>
                <p className="text-xs text-slate-600 pl-7 leading-relaxed">
                  Conduct weekly internal tech talks and build modular documentation to ensure long-term team cross-functionality.
                </p>
              </div>
            </div>
          )}
        </div>
      )
    }

    // 6. Key Risk Factors Tab (LAST TAB)
    if (configKey === 'keyriskfactors') {
      const riskSecs = tabConfigs.find(t => t.key === 'keyriskfactors')?.sections || []

      return (
        <div className="space-y-4">
          <div className="p-3.5 bg-teal-50/80 rounded-xl border border-teal-200/80 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
              <Shield className="w-4 h-4 text-teal-600" />
              <span>Key Risk Factors & Technical Vulnerabilities</span>
            </div>
            <p className="text-xs text-teal-700 leading-relaxed">
              Primary project delivery risks, skill gaps, capacity bottlenecks, and technical constraints.
            </p>
          </div>

          {riskSecs.length > 0 ? (
            riskSecs.map((sec, idx) => (
              <div key={idx} className="space-y-2">
                {sec.title && <h5 className="text-xs font-bold text-slate-800">{sec.title}</h5>}
                {renderSectionItems(sec.items)}
              </div>
            ))
          ) : (
            <div className="space-y-2.5">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  Skill Coverage Deficit
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {miss.length > 0
                    ? `Missing critical technical coverage for ${miss.length} required technology stack areas (${miss.map(s => strip(s)).join(', ')}).`
                    : 'All core project technologies are covered by team members.'}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  Capacity & Bandwidth Bottlenecks
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Project complexity requires specialized engineering focus across architecture, backend APIs, and cloud infrastructure deployment.
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="text-xs font-bold text-teal-700 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                  Feasibility & Quality Control
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Third-party integration points and security protocols necessitate automated testing pipelines and structured code review workflows.
                </p>
              </div>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="space-y-4">
      {/* Control Bar: Mode switch & tab navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        {/* Horizontal Scrollable Tabs */}
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {tabConfigs.map(({ key, label, icon: Icon, color }) => {
            const isActive = currentTabKey === key && viewMode === 'tabbed'
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key)
                  setViewMode('tabbed')
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-teal-500/80 bg-teal-50/70 text-teal-900 shadow-2xs'
                    : 'border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${color} flex items-center justify-center shrink-0 shadow-2xs`}>
                  <Icon className="w-3 h-3 text-white" />
                </div>
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => setViewMode('tabbed')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              viewMode === 'tabbed'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tabbed View
          </button>
          <button
            onClick={() => setViewMode('full')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'full'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3 h-3" /> Full Analysis
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
        {viewMode === 'tabbed' ? (
          renderTabContent(currentTabKey)
        ) : (
          /* Full Document View mode */
          <div className="space-y-6 divide-y divide-slate-200/80">
            {tabConfigs.map((tab, idx) => (
              <div key={tab.key} className={idx === 0 ? 'space-y-3' : 'pt-5 space-y-3'}>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${tab.color} text-white flex items-center justify-center shadow-2xs`}>
                    <tab.icon className="w-3 h-3 text-white" />
                  </div>
                  <h4>{tab.label}</h4>
                </div>
                {renderTabContent(tab.key)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReasoningSection
