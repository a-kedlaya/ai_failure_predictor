import { useState, useRef, useMemo } from 'react'
import { Upload, FileText, Trash2, Plus, Sparkles, Search, ArrowUpDown, Download, Copy } from 'lucide-react'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const ROLE_OPTIONS = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'DevOps Engineer', 'Data Engineer', 'ML Engineer', 'QA Engineer',
  'UI/UX Designer', 'Product Manager', 'Tech Lead', 'Architect',
  'Mobile Developer', 'Security Engineer', 'Cloud Engineer',
]
const SKILL_SUGGESTIONS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS',
  'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL',
  'Django', 'FastAPI', 'Go', 'Rust', 'Java', 'C#', '.NET', 'Vue.js',
  'Angular', 'Next.js', 'Terraform', 'CI/CD', 'Git', 'REST API',
]
const SKILL_COLORS = {
  python: 'bg-blue-100 text-blue-700 border-blue-200',
  javascript: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  typescript: 'bg-blue-100 text-blue-700 border-blue-200',
  react: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'node.js': 'bg-green-100 text-green-700 border-green-200',
  nodejs: 'bg-green-100 text-green-700 border-green-200',
  aws: 'bg-orange-100 text-orange-700 border-orange-200',
  docker: 'bg-sky-100 text-sky-700 border-sky-200',
  kubernetes: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  postgresql: 'bg-slate-100 text-slate-700 border-slate-200',
  mongodb: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  redis: 'bg-red-100 text-red-700 border-red-200',
  graphql: 'bg-pink-100 text-pink-700 border-pink-200',
  django: 'bg-green-100 text-green-800 border-green-200',
  go: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  rust: 'bg-orange-100 text-orange-800 border-orange-200',
  java: 'bg-red-100 text-red-800 border-red-200',
  vue: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'vue.js': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  angular: 'bg-red-100 text-red-700 border-red-200',
  'next.js': 'bg-gray-100 text-gray-800 border-gray-200',
  terraform: 'bg-purple-100 text-purple-700 border-purple-200',
  git: 'bg-orange-100 text-orange-700 border-orange-200',
}
function getSkillColor(skill) {
  const key = skill.toLowerCase().trim()
  return SKILL_COLORS[key] || 'bg-gray-100 text-gray-700 border-gray-200'
}
const createEmptyRow = () => ({
  id: crypto.randomUUID(),
  name: '',
  role: '',
  experience: '',
  skills: [],
  skillInput: '',
})
function Hero({ onAnalyze, isLoading, statusMessage, isError, analysisComplete }) {
  const [requirementsFile, setRequirementsFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localMessage, setLocalMessage] = useState('')
  const [localError, setLocalError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [templateRows, setTemplateRows] = useState([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ])
  const fileInputRef = useRef(null)
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setRequirementsFile(file)
      setLocalMessage('')
    } else {
      setLocalMessage('Please upload a PDF file.')
      setLocalError(true)
    }
  }
  const handleTemplateCellChange = (rowId, field, value) => {
    setTemplateRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    )
  }
  const addSkillToRow = (rowId, skill) => {
    if (!skill.trim()) return
    setTemplateRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        if (row.skills.some(s => s.toLowerCase() === skill.toLowerCase())) return { ...row, skillInput: '' }
        return { ...row, skills: [...row.skills, skill.trim()], skillInput: '' }
      })
    )
  }
  const removeSkillFromRow = (rowId, skillIdx) => {
    setTemplateRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row
        return { ...row, skills: row.skills.filter((_, i) => i !== skillIdx) }
      })
    )
  }
  const addTemplateRow = () => {
    setTemplateRows((prev) => [...prev, createEmptyRow()])
  }
  const duplicateTemplateRow = (rowId) => {
    setTemplateRows((prev) => {
      const source = prev.find((r) => r.id === rowId)
      if (!source) return prev
      const copy = { ...source, id: crypto.randomUUID(), skillInput: '' }
      copy.skills = [...source.skills]
      const idx = prev.findIndex((r) => r.id === rowId)
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }
  const removeTemplateRow = (rowId) => {
    setTemplateRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((row) => row.id !== rowId)
    })
  }
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }
  const filteredAndSorted = useMemo(() => {
    let rows = [...templateRows]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.skills.some(s => s.toLowerCase().includes(q))
      )
    }
    if (sortField) {
      rows.sort((a, b) => {
        let aVal = a[sortField] || ''
        let bVal = b[sortField] || ''
        if (sortField === 'experience') {
          aVal = Number(aVal) || 0
          bVal = Number(bVal) || 0
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
        return 0
      })
    }
    return rows
  }, [templateRows, searchQuery, sortField, sortDir])
  const buildTemplateCsvFile = () => {
    const header = ['name', 'role', 'experience', 'skills']
    const escapeCell = (value) => `"${String(value || '').replace(/"/g, '""')}"`
    const rows = templateRows
      .filter((row) => row.experience || row.skills.length)
      .map((row) => [row.name, row.role, row.experience, row.skills.join(', ')].map(escapeCell).join(','))
    if (!rows.length) return null
    const csvContent = [header.join(','), ...rows].join('\n')
    return new File([csvContent], 'team_template_filled.csv', { type: 'text/csv' })
  }
  const handleSubmit = (e) => {
    e.preventDefault()
    setLocalMessage('')
    setLocalError(false)
    if (!requirementsFile) {
      setLocalMessage('Please upload a requirements PDF before analyzing.')
      setLocalError(true)
      return
    }
    const csvFile = buildTemplateCsvFile()
    if (!csvFile) {
      setLocalMessage('Add at least one team member with experience or skills before analyzing.')
      setLocalError(true)
      return
    }
    onAnalyze(requirementsFile, {
      teamInputMode: 'excel',
      teamData: [],
      teamFile: csvFile,
    })
  }
  return (
    <form onSubmit={handleSubmit}>
      {!analysisComplete && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">
          {/* Left: Requirements Upload */}
          <div className="bg-white rounded-xl border border-gray-200 card-container flex flex-col">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Requirements Upload</h2>
              <p className="text-xs text-gray-500 mt-0.5">Upload your project requirements PDF</p>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-center">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-teal-400 bg-teal-50/50'
                    : requirementsFile
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    setRequirementsFile(e.target.files?.[0] || null)
                    setLocalMessage('')
                  }}
                />
                {requirementsFile ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{requirementsFile.name}</p>
                      <p className="text-xs text-gray-500">{(requirementsFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setRequirementsFile(null) }}
                      className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        <span className="text-teal-600">Click to upload</span> or drag & drop
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">PDF files only (max 25MB)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Right: Team Members */}
          <div className="bg-white rounded-xl border border-gray-200 card-container flex flex-col">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-32"
                  />
                </div>
                <button
                  type="button"
                  onClick={addTemplateRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 font-medium text-xs rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>
            <div className="p-3 flex-1 overflow-hidden">
              <div className="border border-gray-200 rounded-lg overflow-hidden h-full">
                <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[100px]">
                          <button type="button" onClick={() => handleSort('experience')} className="flex items-center gap-1 hover:text-gray-700">
                            Exp (yrs)
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Skills</th>
                        <th className="px-4 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAndSorted.map((row, idx) => (
                        <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-teal-50/30 transition-colors`}>
                          <td className="px-4 py-1.5">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={row.experience}
                              onChange={(e) => handleTemplateCellChange(row.id, 'experience', e.target.value)}
                              placeholder="0"
                              className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 text-center"
                            />
                          </td>
                          <td className="px-4 py-1.5">
                            <SkillsInput
                              skills={row.skills}
                              skillInput={row.skillInput}
                              onInputChange={(val) => handleTemplateCellChange(row.id, 'skillInput', val)}
                              onAdd={(skill) => addSkillToRow(row.id, skill)}
                              onRemove={(idx) => removeSkillFromRow(row.id, idx)}
                            />
                          </td>
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => duplicateTemplateRow(row.id)}
                                className="p-1 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                                title="Duplicate member"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTemplateRow(row.id)}
                                className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Remove member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Action Bar */}
      <div className="flex items-center gap-3 mt-3">
        {(localMessage || (statusMessage && statusMessage !== 'Analysis complete.')) && (
          <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            (localError || isError)
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-teal-50 text-teal-700 border border-teal-200'
          }`}>
            {localMessage || statusMessage}
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!analysisComplete && (
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary text-sm py-2 px-6"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Project
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
// Skills Input Component
function SkillsInput({ skills, skillInput, onInputChange, onAdd, onRemove }) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const filtered = SKILL_SUGGESTIONS.filter(s =>
    s.toLowerCase().includes(skillInput.toLowerCase()) &&
    !skills.some(existing => existing.toLowerCase() === s.toLowerCase())
  )
  return (
    <div className="space-y-1.5">
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.map((skill, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getSkillColor(skill)}`}
            >
              {skill}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="hover:opacity-70 ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={skillInput}
          onChange={(e) => { onInputChange(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              if (skillInput.trim()) onAdd(skillInput)
            }
          }}
          placeholder="Add skill..."
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-400"
        />
        {showSuggestions && skillInput && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
            {filtered.slice(0, 6).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onAdd(s); setShowSuggestions(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
export default Hero
