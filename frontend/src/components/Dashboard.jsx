import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { 
  Shield, BarChart3, CheckCircle2, XCircle, Brain, X, 
  Sparkles, ExternalLink 
} from 'lucide-react'
import RiskSummary from './RiskSummary'
import RiskChart from './RiskChart'
import SkillsSection from './SkillsSection'
import ReasoningSection from './ReasoningSection'

const SECTION_CONFIGS = {
  available: { label: 'Available Skills', icon: Sparkles, color: 'from-teal-500 to-emerald-600' },
  required: { label: 'Required Skills', icon: CheckCircle2, color: 'from-cyan-500 to-teal-600' },
  missing: { label: 'Missing Skills', icon: XCircle, color: 'from-orange-500 to-red-500' },
  reasoning: { label: 'AI Reasoning', icon: Brain, color: 'from-slate-600 to-gray-700' },
}

function Dashboard({ report }) {
  const [activeSection, setActiveSection] = useState(null)

  // Extract combined available skills list
  const rawAvailable = Array.isArray(report?.availableSkills) ? report.availableSkills : []
  const teamSkills = (Array.isArray(report?.teamData) ? report.teamData : []).flatMap((m) =>
    Array.isArray(m.skills) ? m.skills : []
  )
  const combinedAvailableSkills = useMemo(() => Array.from(
    new Set(
      [...rawAvailable, ...teamSkills]
        .map((s) => String(s || '').replace(/\*+/g, '').trim())
        .filter(Boolean)
    )
  ), [rawAvailable, teamSkills])

  const stripStars = (s) => String(s || '').replace(/\*+/g, '').trim()
  const reqSkillsList = (report?.requiredSkills || []).map(stripStars)
  const missSkillsList = (report?.missingSkills || []).map(stripStars)

  // Dynamic preview strings for 4 side-by-side cards
  const availPreview = combinedAvailableSkills.length > 0
    ? `${combinedAvailableSkills.length} skills (${combinedAvailableSkills.slice(0, 3).join(', ')}${combinedAvailableSkills.length > 3 ? '...' : ''})`
    : 'No available skills identified in team profile.'

  const reqPreview = reqSkillsList.length > 0
    ? `${reqSkillsList.length} skills (${reqSkillsList.slice(0, 3).join(', ')}${reqSkillsList.length > 3 ? '...' : ''})`
    : 'No required skills specified in requirements.'

  const missPreview = missSkillsList.length > 0
    ? `${missSkillsList.length} gap(s) (${missSkillsList.slice(0, 3).join(', ')}${missSkillsList.length > 3 ? '...' : ''})`
    : 'All required skills covered by team.'

  const activeConfig = activeSection ? SECTION_CONFIGS[activeSection] : null

  const renderModalContent = (key) => {
    switch (key) {
      case 'available':
        return <SkillsSection title="Available Skills" skills={combinedAvailableSkills} />
      case 'required':
        return <SkillsSection title="Required Skills" skills={report?.requiredSkills} />
      case 'missing':
        return <SkillsSection title="Missing Skills" skills={report?.missingSkills} availableSkills={combinedAvailableSkills} />
      case 'reasoning':
        return (
          <ReasoningSection
            reasoning={report.aiReasoning}
            recommendedTeamStructure={report.recommendedTeamStructure}
            requiredSkills={report.requiredSkills}
            availableSkills={combinedAvailableSkills}
            missingSkills={report.missingSkills}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-2">
      {/* Top Inline Row: Risk Assessment & Project Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Risk Assessment Card */}
        <div className="bg-white rounded-2xl border border-slate-200 card-container p-3 shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-100">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-xs">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Risk Assessment</h3>
          </div>
          <RiskSummary report={report} />
        </div>

        {/* Project Metrics Card */}
        <div className="bg-white rounded-2xl border border-slate-200 card-container p-3 shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-100">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xs">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-xs font-bold text-slate-900">Project Metrics</h3>
          </div>
          <RiskChart failureProbability={report.failureProbability} complexity={report.complexity} deadline={report.deadline} />
        </div>
      </div>

      {/* Detailed Analytics Container */}
      <div className="bg-white rounded-2xl border border-slate-200 card-container p-3 space-y-2 shadow-2xs">
        <div className="pb-1 border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detailed Analytics</h3>
        </div>

        {/* 4 Detailed Analytics Cards side-by-side with View buttons that open modal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* 1. Available Skills */}
          <div 
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all overflow-hidden flex flex-col h-full cursor-pointer group"
            onClick={() => setActiveSection('available')}
          >
            <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-50/60 transition-colors gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 shrink-0 tracking-tight">Available Skills</h4>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveSection('available') }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all cursor-pointer shadow-2xs border border-teal-200/80"
              >
                <span>View</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3 pb-2.5 pt-0 flex-1">
              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-tight">
                {availPreview}
              </p>
            </div>
          </div>

          {/* 2. Required Skills */}
          <div 
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all overflow-hidden flex flex-col h-full cursor-pointer group"
            onClick={() => setActiveSection('required')}
          >
            <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-50/60 transition-colors gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 shrink-0 tracking-tight">Required Skills</h4>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveSection('required') }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all cursor-pointer shadow-2xs border border-teal-200/80"
              >
                <span>View</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3 pb-2.5 pt-0 flex-1">
              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-tight">
                {reqPreview}
              </p>
            </div>
          </div>

          {/* 3. Missing Skills */}
          <div 
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all overflow-hidden flex flex-col h-full cursor-pointer group"
            onClick={() => setActiveSection('missing')}
          >
            <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-50/60 transition-colors gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <XCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 shrink-0 tracking-tight">Missing Skills</h4>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveSection('missing') }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all cursor-pointer shadow-2xs border border-teal-200/80"
              >
                <span>View</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3 pb-2.5 pt-0 flex-1">
              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-tight">
                {missPreview}
              </p>
            </div>
          </div>

          {/* 4. AI Reasoning */}
          <div 
            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all overflow-hidden flex flex-col h-full cursor-pointer group"
            onClick={() => setActiveSection('reasoning')}
          >
            <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-50/60 transition-colors gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-slate-600 to-gray-700 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 shrink-0 tracking-tight">AI Reasoning</h4>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveSection('reasoning') }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-2xs border border-slate-700"
              >
                <span>View</span>
                <Brain className="w-3 h-3" />
              </button>
            </div>
            <div className="px-3 pb-2.5 pt-0 flex-1">
              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-tight">
                Executive summary, risk analysis & strategic action plan.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Modal Popup overlay for any selected section */}
      {activeSection && activeConfig && createPortal(
        <div 
          className="fixed inset-0 z-[999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveSection(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-100 overflow-hidden animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between text-white bg-gradient-to-r ${activeConfig.color}`}>
              <div className="flex items-center gap-3">
                <activeConfig.icon className="w-5 h-5 text-white" />
                <h4 className="text-base font-semibold text-white">{activeConfig.label}</h4>
              </div>
              <button
                onClick={() => setActiveSection(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer border border-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-6 overflow-y-auto flex-1 bg-slate-50/30">
              {renderModalContent(activeSection)}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Dashboard
