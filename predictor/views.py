from django.shortcuts import render
from django.http import JsonResponse, FileResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import io
import json
import os
import re
import pdfplumber
import pandas as pd
import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak
from xml.sax.saxutils import escape as xml_escape
# ======================
# STORE LAST REPORT
# ======================
LAST_REPORT = None
def _to_str(value):
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    return str(value).strip()
def _to_experience(value):
    if value is None:
        return 0
    if isinstance(value, float) and pd.isna(value):
        return 0
    try:
        # Handles values like 3, 3.5, "3 years", "7.5", "10+"
        number_text = re.findall(r"\d+(?:\.\d+)?", str(value))
        if not number_text:
            return 0
        return round(float(number_text[0]), 1)
    except (TypeError, ValueError):
        return 0
def _to_skills(value):
    if value is None:
        return []
    if isinstance(value, float) and pd.isna(value):
        return []
    if isinstance(value, list):
        return [str(skill).strip() for skill in value if str(skill).strip()]
    # Accept comma/newline/semicolon-separated skills from manual text or spreadsheets.
    chunks = re.split(r"[,;\n\r]+", str(value))
    return [skill.strip() for skill in chunks if skill.strip()]
def _normalize_key(key):
    normalized = re.sub(r"[^a-z0-9]", "", str(key or "").lower())
    return normalized
def _pick_value(record, key_aliases):
    if not isinstance(record, dict):
        return None
    lookup = {_normalize_key(k): v for k, v in record.items()}
    for alias in key_aliases:
        alias_key = _normalize_key(alias)
        if alias_key in lookup:
            return lookup[alias_key]
    return None
def _normalize_team_member(record):
    name = _to_str(_pick_value(record, ["name", "employee", "employee_name", "member", "developer_name"]))
    role = _to_str(_pick_value(record, ["role", "designation", "title", "position"]))
    experience = _to_experience(_pick_value(record, [
        "experience",
        "experiance",
        "experince",
        "years",
        "years_of_experience",
        "yrs",
        "yr",
        "exp",
    ]))
    skills = _to_skills(_pick_value(record, ["skills", "skill", "skillset", "tech_skills", "technologies"]))
    return {
        "name": name,
        "role": role,
        "experience": experience,
        "skills": skills,
    }
def _normalize_team_records(team_data):
    normalized = []
    for record in team_data or []:
        if not isinstance(record, dict):
            continue
        member = _normalize_team_member(record)
        # Keep rows that have at least some useful detail.
        if member["name"] or member["role"] or member["experience"] or member["skills"]:
            normalized.append(member)
    return normalized
def _report_cache_path():
    return os.path.join(settings.BASE_DIR, "predictor", "uploads", "last_report.json")
def _save_last_report(report_payload):
    try:
        with open(_report_cache_path(), "w", encoding="utf-8") as cache_file:
            json.dump(report_payload, cache_file, ensure_ascii=False, indent=2)
    except OSError:
        pass
def _load_last_report():
    try:
        with open(_report_cache_path(), "r", encoding="utf-8") as cache_file:
            return json.load(cache_file)
    except (OSError, json.JSONDecodeError):
        return None
# ======================
# ANALYSIS API
# ======================
@csrf_exempt
@require_POST
def analyze_project(request):
    global LAST_REPORT
    try:
        pdf_file = request.FILES.get("requirements")
        excel_file = request.FILES.get("team")
        team_json_str = request.POST.get("team_json")
        print(f"[DEBUG] Received request with FILES: {list(request.FILES.keys())}, POST keys: {list(request.POST.keys())}")
        print(f"[DEBUG] PDF file: {pdf_file}, Excel file: {excel_file}, team_json: {bool(team_json_str)}")
        # Validate PDF file
        if not pdf_file:
            return JsonResponse({"error": "Missing 'requirements' PDF file"}, status=400)
        project_name = "Untitled Project"
        if pdf_file and getattr(pdf_file, "name", None):
            project_name = os.path.splitext(
                os.path.basename(pdf_file.name)
            )[0].replace("_", " ").replace("-", " ").strip() or project_name
        extracted_text = ""
        if pdf_file:
            with pdfplumber.open(pdf_file) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    # Extract main text with layout preservation
                    page_text = page.extract_text(
                        x_tolerance=3,
                        y_tolerance=3,
                        layout=False,
                    )
                    if page_text:
                        extracted_text += page_text + "\n"
                    # Also extract tables from each page (often missed by extract_text)
                    tables = page.extract_tables()
                    for table in tables:
                        if not table:
                            continue
                        for row in table:
                            if row:
                                row_text = " | ".join(
                                    str(cell).strip() for cell in row if cell
                                )
                                if row_text.strip():
                                    extracted_text += row_text + "\n"
        print(f"[DEBUG] Extracted {len(extracted_text)} chars from PDF ({page_num} pages)")
        team_data = []
        # Try new format first (team_json from form)
        if team_json_str:
            try:
                team_data = json.loads(team_json_str)
                print(f"[DEBUG] Loaded team data from JSON: {len(team_data)} members")
            except json.JSONDecodeError as e:
                print(f"[DEBUG] Failed to parse team_json: {str(e)}")
                return JsonResponse({"error": "Invalid team data format"}, status=400)
        # Fallback to old format (Excel file)
        elif excel_file:
            file_name = (getattr(excel_file, "name", "") or "").lower()
            if file_name.endswith(".csv"):
                df = pd.read_csv(excel_file)
            else:
                df = pd.read_excel(excel_file)
            team_data = df.to_dict(orient="records")
            print(f"[DEBUG] Loaded team data from Excel: {len(team_data)} members")
        else:
            return JsonResponse({"error": "Missing team data. Please add team members."}, status=400)
        team_data = _normalize_team_records(team_data)
        if not team_data:
            return JsonResponse({
                "error": "No valid team rows found. Use headers: name, role, experience, skills."
            }, status=400)
        team_size = len(team_data)
        avg_experience = round(
            sum(member.get("experience", 0) for member in team_data) / team_size,
            1,
        ) if team_size else 0.0
        team_members_text = "\n".join([
            f"- {member.get('name') or 'Unknown'} | {member.get('role') or 'Unknown'} | {member.get('experience', 0)} yrs | skills: {', '.join(member.get('skills', [])) or 'none'}"
            for member in team_data
        ])
        # Append skill-inference guidance so the AI analyzes use cases, not just the tech stack
        skill_guidance = (
            "\n\n---\n"
            "SKILL ANALYSIS INSTRUCTIONS:\n"
            "You MUST analyze the ENTIRE requirements document above thoroughly. "
            "Based on ALL features, integrations, architecture, and technical requirements described, "
            "determine the 'requiredSkills' needed to build this system.\n\n"
            "RULES:\n"
            "- You MUST return at least 5-15 skills in 'requiredSkills' - NEVER return an empty list\n"
            "- Return SHORT skill names only (e.g., 'React', 'PostgreSQL', 'Kubernetes', 'Docker')\n"
            "- Do NOT return long descriptions (WRONG: 'cloud-native application development')\n"
            "- Do NOT return generic categories (WRONG: 'frontend development', 'backend development')\n"
            "- Do NOT return process skills (WRONG: 'ci/cd pipeline setup', 'unit testing')\n"
            "- ONLY return specific named technologies, frameworks, platforms, or tools\n"
            "- Infer from the full document: tech stack, integrations, security, architecture, "
            "databases, APIs, cloud services, frameworks, and languages\n"
            "- If the document mentions web UI -> infer React/Angular/Vue\n"
            "- If it mentions database -> infer PostgreSQL/MySQL/MongoDB\n"
            "- If it mentions APIs -> infer REST/GraphQL/Node.js\n"
            "- If it mentions cloud/deployment -> infer AWS/Azure/Docker/Kubernetes\n"
            "- If it mentions authentication -> infer OAuth2/JWT\n"
            "- Examples of GOOD skills: React, Node.js, PostgreSQL, Redis, Docker, Kubernetes, AWS, "
            "RabbitMQ, Elasticsearch, Terraform, OAuth2, Python, Django, TypeScript, Java, Spring Boot\n"
            "- IMPORTANT: requiredSkills must NOT be empty. Analyze the document and infer technologies.\n"
        )
        analysis_text = (
            "=== BEGIN REQUIREMENTS DOCUMENT ===\n"
            + extracted_text
            + "\n=== END REQUIREMENTS DOCUMENT ===\n"
            + skill_guidance
        )
        payload = {
            "extractedText": analysis_text,
            "teamData": team_data,
            "teamSummary": {
                "teamSize": team_size,
                "avgExperience": avg_experience,
            },
            "teamMembersText": team_members_text,
            "responseStyle": "precise",
            "responseConstraints": {
                "maxSentencesPerParagraph": 2,
                "maxBulletsPerSection": 4,
                "preferTablesForStructuredData": True,
                "avoidRepetition": True,
            },
        }
        print(f"[DEBUG] Sending payload to n8n with extracted_text length: {len(extracted_text)}, team records: {len(team_data)}")
        print(f"[DEBUG] First 500 chars of extracted text: {extracted_text[:500]}")
        response = requests.post(
            "http://localhost:5678/webhook/project-analysis1",
            json=payload,
            timeout=120,
        )
        print(f"[DEBUG] n8n response status: {response.status_code}")
        if response.status_code != 200:
            print(f"[DEBUG] n8n error response: {response.text[:500]}")
            return JsonResponse({
                "error": "n8n workflow failed",
                "details": response.text,
            }, status=502)
        result = response.json()
        if isinstance(result, dict):
            if isinstance(result.get("report"), dict):
                result["report"]["teamData"] = team_data
            else:
                result["teamData"] = team_data
        print(f"[DEBUG] Analysis successful, returning result")
        LAST_REPORT = {
            "report": result.get("report", result),
            "project_name": project_name,
        }
        _save_last_report(LAST_REPORT)
        return JsonResponse(result)
    except Exception as e:
        print(f"[ERROR] Exception in analyze_project: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)
# ======================
# SAVE CORRECTED REPORT
# ======================
@csrf_exempt
def save_corrected_report(request):
    """Accept the frontend-corrected report so the PDF matches the UI."""
    global LAST_REPORT
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        data = json.loads(request.body)
        report = data.get("report")
        project_name = data.get("project_name", "Untitled Project")
        if not report:
            return JsonResponse({"error": "No report data provided"}, status=400)
        LAST_REPORT = {
            "report": report,
            "project_name": project_name,
        }
        _save_last_report(LAST_REPORT)
        return JsonResponse({"status": "ok"})
    except (json.JSONDecodeError, Exception) as e:
        return JsonResponse({"error": str(e)}, status=400)
# ======================
# PDF HELPERS
# ======================
def _reasoning_to_html(text):
    if not text:
        return "No reasoning was returned."
    parts = []
    for raw_line in str(text).splitlines():
        # remove leading numeric prefixes (e.g. "1. ", "2) ")
        line = re.sub(r'^\s*\d+[\.)]\s*', '', raw_line).strip()
        if not line:
            parts.append("<br/><br/>")
            continue
        # Skip horizontal rules (---, ***, ___) and table lines
        if re.match(r"^[-*_]{3,}$", line):
            continue
        if "|" in line or re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$", line):
            continue
        heading_match = re.match(r"^(#{1,3})\s*(.+)$", line)
        numbered_heading_match = re.match(r"^\d+[\.)]\s+([A-Z][^:]{3,80})$", line)
        ordered_match = re.match(r"^\d+[\.)]\s+(.+)$", line)
        bullet_match = re.match(r"^[-*\u2022]\s+(.+)$", line)
        if heading_match:
            parts.append(f"<b>{_format_pdf_inline(heading_match.group(2))}</b><br/>")
            continue
        if numbered_heading_match:
            parts.append(f"<b>{_format_pdf_inline(numbered_heading_match.group(1))}</b><br/>")
            continue
        if ordered_match:
            parts.append(f"&nbsp;&nbsp;{_format_pdf_inline(ordered_match.group(1))}<br/>")
            continue
        if bullet_match:
            parts.append(f"&bull; {_format_pdf_inline(bullet_match.group(1))}<br/>")
            continue
        parts.append(f"{_format_pdf_inline(line)}<br/>")
    return "".join(parts)
def _format_pdf_inline(text):
    escaped = xml_escape(str(text).strip())
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"\*(.+?)\*", r"\1", escaped)
    return escaped
def _strip_markdown(text):
    text = str(text).strip()
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    return text.strip()
def _normalize_markdown_heading(line):
    heading = re.sub(r"^#{1,6}\s*", "", str(line).strip())
    heading = re.sub(r"^\d+[\.)]\s*", "", heading)
    heading = heading.strip("* ").strip()
    return heading.lower()
def _extract_section_content(text, heading_keyword):
    """Extract all content under a section heading until the next heading."""
    if not text:
        return None
    lines = str(text).splitlines()
    capturing = False
    content_lines = []
    start_level = None
    for line in lines:
        stripped = line.strip()
        # Determine if this line is a markdown heading
        heading_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        is_heading = bool(heading_match) or bool(
            re.match(r"^\d+\.\s+[A-Z]", stripped) and len(stripped) < 80
        )
        if is_heading:
            level = len(heading_match.group(1)) if heading_match else 3
            heading_title = heading_match.group(2) if heading_match else stripped
            if heading_keyword.lower() in heading_title.lower():
                capturing = True
                start_level = level
                continue
            elif capturing:
                # Stop if we hit another heading of the same or higher level
                if level <= start_level:
                    break
                else:
                    content_lines.append(line)
                    continue
        if capturing:
            content_lines.append(line)
    if not content_lines:
        return None
    return "\n".join(content_lines).strip()
def _extract_full_action_plan(text):
    """Extract Executive Action Plan and everything after it."""
    if not text:
        return None
    lines = str(text).splitlines()
    capturing = False
    content_lines = []
    for line in lines:
        stripped = line.strip()
        is_major_heading = bool(re.match(r"^#{1,3}\s+\d+\.\s+", stripped)) or bool(
            re.match(r"^#{1,3}\s+", stripped) and not stripped.startswith("####")
        )
        if "action plan" in stripped.lower() or "executive action" in stripped.lower():
            capturing = True
            continue
        if capturing:
            content_lines.append(line)
    if not content_lines:
        return None
    return "\n".join(content_lines).strip()
def _section_to_html(section_text):
    """Convert a section's markdown content to HTML for PDF."""
    if not section_text:
        return ""
    html = ""
    for line in section_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped == "---":
            continue
        # Strip all markdown bold markers first
        clean = re.sub(r"\*\*(.+?)\*\*", r"\1", stripped)
        clean = re.sub(r"\*(.+?)\*", r"\1", clean)
        # Headings (any # level)
        if stripped.startswith("#"):
            title = re.sub(r"^#{1,6}\s+", "", clean).strip()
            html += f"<br/><b>{xml_escape(title)}</b><br/>"
        elif re.match(r"^\d+\.\s+.+:\s*$", clean):
            # Numbered sub-heading ending with colon like "1. Hire Key Roles:"
            text = re.sub(r"^\d+\.\s+", "", clean).strip().rstrip(":")
            html += f"<br/><b>{xml_escape(text)}</b><br/>"
        elif clean.startswith("-") or clean.startswith("•"):
            bullet_text = re.sub(r"^[-•]\s+", "", clean).strip()
            html += f"&nbsp;&nbsp;&bull; {xml_escape(bullet_text)}<br/>"
        elif re.match(r"^\d+\.\s+", clean):
            # Numbered item
            text = re.sub(r"^\d+\.\s+", "", clean).strip()
            html += f"&bull; {xml_escape(text)}<br/>"
        else:
            # Label: Value or plain text
            label_match = re.match(r"^([A-Za-z\s/]+):\s*(.*)$", clean)
            if label_match and len(label_match.group(1)) < 40:
                html += f"<b>{xml_escape(label_match.group(1).strip())}:</b> {xml_escape(label_match.group(2))}<br/>"
            else:
                html += f"{xml_escape(clean)}<br/>"
    while html.endswith("<br/>"):
        html = html[:-5]
    return html
def _extract_markdown_table(text, heading="Recommended Team Structure"):
    if not text:
        return None
    lines = str(text).splitlines()
    start_index = None
    target_heading = _normalize_markdown_heading(heading)
    for index, line in enumerate(lines):
        if _normalize_markdown_heading(line) == target_heading:
            start_index = index + 1
            break
    if start_index is None:
        return None
    table_lines = []
    for line in lines[start_index:]:
        stripped = line.strip()
        if stripped.startswith("###") and table_lines:
            break
        if "|" in stripped:
            table_lines.append(stripped)
        elif table_lines:
            break
    if len(table_lines) < 2:
        return None
    header = [_strip_markdown(cell) for cell in table_lines[0].strip("|").split("|")]
    body_lines = []
    for raw_line in table_lines[1:]:
        if re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$", raw_line):
            continue
        row = [_strip_markdown(cell) for cell in raw_line.strip("|").split("|")]
        if len(row) == len(header):
            body_lines.append(row)
    if not body_lines:
        return None
    return header, body_lines
def _extract_section_lines(text, heading):
    if not text:
        return []
    lines = str(text).splitlines()
    target_heading = _normalize_markdown_heading(heading)
    start_index = None
    for index, line in enumerate(lines):
        if _normalize_markdown_heading(line) == target_heading:
            start_index = index + 1
            break
    if start_index is None:
        return []
    section_lines = []
    for line in lines[start_index:]:
        stripped = line.strip()
        if not stripped:
            continue
        if _normalize_markdown_heading(stripped) != target_heading and re.match(r"^(#{1,6}\s*)?\d+[\.)]\s+[A-Z]", stripped):
            break
        if stripped.startswith("#"):
            break
        section_lines.append(stripped)
    return section_lines
def _extract_labeled_bullet_table(text, heading, headers):
    rows = []
    for line in _extract_section_lines(text, heading):
        if "|" in line:
            continue
        bullet_match = re.match(r"^[-*\u2022]\s+(.+)$", line)
        if not bullet_match:
            continue
        item = _strip_markdown(bullet_match.group(1))
        label_match = re.match(r"^([^:]{2,80}):\s*(.+)$", item)
        if label_match:
            rows.append([label_match.group(1).strip(), label_match.group(2).strip()])
        else:
            rows.append([item.strip(), ""])
    if not rows:
        return None
    return headers, rows
def _table_col_widths(headers):
    normalized_headers = [header.lower() for header in headers]
    if len(headers) == 2:
        return [48 * mm, 122 * mm]
    if any("mitigation" in header or "strategy" in header for header in normalized_headers):
        return [34 * mm, 42 * mm, 24 * mm, 70 * mm]
    if len(headers) == 3:
        return [52 * mm, 38 * mm, 80 * mm]
    column_width = 170 * mm / max(len(headers), 1)
    return [column_width] * len(headers)
def _make_table_block(title, headers, rows, styles, background="#f7fbff", border="#dbe7f3", accent="#2563eb"):
    data = [[Paragraph(f"<b>{xml_escape(_strip_markdown(cell))}</b>", styles["TableHeader"]) for cell in headers]]
    for row in rows:
        data.append([Paragraph(_format_pdf_inline(cell), styles["Body"]) for cell in row])
    table = Table(data, repeatRows=1, colWidths=_table_col_widths(headers))
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(accent)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#fbfdff")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(border)),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, colors.HexColor(accent)),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffffff"), colors.HexColor("#f8fafc")]),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    title_bar = Table(
        [[Paragraph(title, styles["SectionHeading"])]],
        colWidths=[170 * mm],
    )
    title_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(background)),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return [
        title_bar,
        Spacer(1, 4),
        table,
    ]
def _make_panel(title, body_html, styles, background="#f7fbff", border="#dbe7f3", accent="#2563eb", total_width=None):
    panel_width = total_width or 170 * mm
    body_width = panel_width - 3 * mm
    # Title header with accent bar (small, non-splittable)
    accent_bar = Table(
        [[Paragraph("", styles["Body"])]],
        colWidths=[3 * mm],
        rowHeights=[24],
    )
    accent_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(accent)),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    title_cell = Table(
        [[Paragraph(title, styles["SectionHeading"])]],
        colWidths=[body_width],
    )
    title_cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(background)),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    header_row = Table(
        [[accent_bar, title_cell]],
        colWidths=[3 * mm, body_width],
    )
    header_row.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(border)),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [4, 4, 0, 0]),
    ]))
    # Body style with background-colored indent to match panel look
    body_style = ParagraphStyle(
        "PanelBody",
        parent=styles["Body"],
        leftIndent=14,
        rightIndent=14,
        spaceBefore=6,
        spaceAfter=8,
        backColor=colors.HexColor(background),
        borderColor=colors.HexColor(border),
        borderWidth=0.5,
        borderPadding=(8, 12, 10, 12),
    )
    body_paragraph = Paragraph(body_html, body_style)
    # Header is a small table (won't overflow), body is a free-flowing
    # Paragraph that ReportLab can split across pages
    return [header_row, body_paragraph]
def _make_metric(label, value, accent, styles):
    accent_bar = Table(
        [[Paragraph("", styles["Body"])]],
        colWidths=[1.5 * mm],
    )
    accent_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(accent)),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    metric_body = Table(
        [
            [Paragraph(f"<font color='#64748b' size='7'>{xml_escape(label)}</font>", styles["Body"])],
            [Paragraph(f"<font color='{accent}'><b>{xml_escape(str(value))}</b></font>", styles["MetricValue"])],
        ],
        colWidths=[50.5 * mm],
    )
    metric_body.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (0, 0), 6),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (0, 1), 1),
    ]))
    table = Table(
        [[accent_bar, metric_body]],
        colWidths=[1.5 * mm, 52.5 * mm], # Total 54 * mm (fits inside 56 * mm column!)
    )
    table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
    ]))
    return table
# ======================
# PDF DOWNLOAD
# ======================
def download_report(request):
    global LAST_REPORT
    report_payload = _load_last_report() or LAST_REPORT
    if not report_payload:
        return JsonResponse({"error": "No report available. Analyze a project first."})
    report = report_payload.get("report", report_payload)
    project_name = report_payload.get("project_name", "Untitled Project")
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
        textColor=colors.white,
        spaceAfter=0,
    ))
    styles.add(ParagraphStyle(
        name="ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15,
        textColor=colors.HexColor("#94a3b8"),
        spaceAfter=0,
    ))
    styles.add(ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=0,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        name="MetricValue",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=0,
    ))
    styles.add(ParagraphStyle(
        name="TableHeader",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.white,
        spaceAfter=0,
    ))
    styles.add(ParagraphStyle(
        name="Callout",
        parent=styles["Body"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748b"),
    ))
    styles.add(ParagraphStyle(
        name="FooterText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#94a3b8"),
        alignment=TA_CENTER,
    ))
    content = []
    # --- TITLE BANNER (deep navy gradient-style) ---
    title_banner = Table(
        [
            [Paragraph("AI Project Risk Intelligence Report", styles["ReportTitle"])],
            [Paragraph("A concise summary of the AI-assisted project risk analysis.", styles["ReportSubtitle"])],
        ],
        colWidths=[170 * mm],
    )
    title_banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("BOX", (0, 0), (-1, -1), 0, colors.HexColor("#0f172a")),
        ("LINEBELOW", (0, -1), (-1, -1), 3, colors.HexColor("#3b82f6")),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("TOPPADDING", (0, 0), (0, 0), 18),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 16),
        ("TOPPADDING", (0, 1), (0, 1), 4),
        ("ROUNDEDCORNERS", [6, 6, 0, 0]),
    ]))
    project_card = Table(
        [[
            Paragraph("<font color='#64748b'>Project</font>", styles["Body"]),
            Paragraph(f"<b>{xml_escape(project_name)}</b>", styles["Body"]),
        ]],
        colWidths=[32 * mm, 138 * mm],
    )
    project_card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [0, 0, 4, 4]),
    ]))
    content.append(title_banner)
    content.append(project_card)
    content.append(Spacer(1, 14))
    # ============================================================
    # ROW 1: Risk Assessment | Project Metrics  (matches UI row 1)
    # ============================================================
    probability = report.get("failureProbability", 0)
    risk_level = report.get("riskLevel", "Unknown")
    success_rate = 100 - (probability or 0)
    team_skills = report.get("availableSkills", [])
    req_skills = report.get("requiredSkills", [])
    skill_match = round((len(team_skills) / len(req_skills)) * 100) if req_skills else 0
    missing_count = len(report.get("missingSkills", []))
    col_half = 83 * mm
    # -- Risk Assessment (left) --
    risk_kpis = Table(
        [
            [
                _make_metric("Success Rate", f"{success_rate}%", "#059669", styles),
                _make_metric("Skill Match", f"{skill_match}%", "#0d9488", styles),
                _make_metric("Missing Skills", str(missing_count), "#d97706", styles),
            ],
        ],
        colWidths=[56 * mm, 56 * mm, 56 * mm],
    )
    risk_kpis.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    risk_header_html = (
        f"<b>Risk Assessment</b> &#160;&#160;"
        f"<font color='{'#dc2626' if 'high' in risk_level.lower() else '#d97706' if 'medium' in risk_level.lower() else '#059669'}'>"
        f"[{xml_escape(risk_level)}]</font><br/><br/>"
        f"<font size='18'><b>{probability}%</b></font> &#160;"
        f"<font color='#64748b' size='9'>Risk Score</font>"
    )
    risk_body = Paragraph(risk_header_html, ParagraphStyle(
        "RiskBody", parent=styles["Body"], alignment=TA_CENTER, spaceBefore=4, spaceAfter=8,
    ))
    risk_panel_rows = [[risk_body], [risk_kpis]]
    risk_panel = Table(risk_panel_rows, colWidths=[170 * mm])
    risk_panel.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (0, 0), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    content.append(risk_panel)
    content.append(Spacer(1, 6))
    # -- Project Metrics (legend-style, since charts can't render in PDF) --
    complexity = report.get("complexity", "N/A")
    deadline = report.get("deadline", "N/A")
    metrics_row = Table(
        [
            [
                _make_metric("Failure Risk", f"{probability}%", "#dc2626", styles),
                _make_metric("Complexity", str(complexity), "#d97706", styles),
                _make_metric("Timeline", str(deadline), "#2563eb", styles),
            ],
        ],
        colWidths=[56 * mm, 56 * mm, 56 * mm],
    )
    metrics_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    metrics_title = Table(
        [[Paragraph("<b>Project Metrics</b> &#160; <font color='#64748b' size='8'>Risk factors visualization</font>", styles["Body"])]],
        colWidths=[170 * mm],
    )
    metrics_title.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    metrics_panel = Table([[metrics_title], [metrics_row]], colWidths=[170 * mm])
    metrics_panel.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    content.append(metrics_panel)
    content.append(Spacer(1, 14))
    # ============================================================
    # ROW 2: Team Overview | Team Composition  (matches UI row 2)
    # ============================================================
    team_data = report.get("teamData", [])
    team_size = len(team_data) or report.get("developers", 0)
    avg_exp = round(sum(float(m.get("experience", 0) or 0) for m in team_data) / len(team_data), 1) if team_data else report.get("avgExperience", 0)
    maturity = "Senior" if avg_exp > 5 else ("Mid-level" if avg_exp > 2 else "Junior")
    team_overview_html = (
        f"<b>Team Overview</b><br/><br/>"
        f"<b>{team_size}</b> Members &#160;&#160; | &#160;&#160; "
        f"<b>{avg_exp}</b> Avg Years &#160;&#160; | &#160;&#160; "
        f"<b>{maturity}</b> Maturity<br/><br/>"
    )
    if team_size:
        team_overview_html += (
            f"Team has <b>{team_size} members</b> with an average of "
            f"<b>{avg_exp} years</b> experience."
        )
    # Team Composition - top skills
    all_skills = []
    for m in team_data:
        all_skills.extend(m.get("skills", []))
    skill_counts = {}
    for s in all_skills:
        skill_counts[s] = skill_counts.get(s, 0) + 1
    top_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    team_comp_html = "<b>Team Composition</b><br/><br/>"
    if top_skills:
        team_comp_html += ", &#160; ".join(
            f"<font color='#374151'>{xml_escape(skill)}</font> <font color='#9ca3af'>({count}x)</font>"
            for skill, count in top_skills
        )
    else:
        team_comp_html += "<font color='#9ca3af'>No skills data</font>"
    team_row = Table(
        [
            [
                Paragraph(team_overview_html, styles["Body"]),
                Paragraph(team_comp_html, styles["Body"]),
            ]
        ],
        colWidths=[col_half + 2 * mm, col_half + 2 * mm],
    )
    team_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#e2e8f0")),
        ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    content.append(team_row)
    content.append(Spacer(1, 14))
    # ============================================================
    # ROW 3: Required Skills | Missing Skills  (matches UI row 3)
    # ============================================================
    required_skills = report.get("requiredSkills", [])
    missing_skills = report.get("missingSkills", [])
    req_html = f"<b>Required Skills</b> &#160; <font color='#0d9488' size='8'>({len(required_skills)} skills)</font><br/><br/>"
    if required_skills:
        req_html += ", &#160; ".join(
            f"<font color='#374151'>{xml_escape(str(s).strip('*').strip())}</font>"
            for s in required_skills
        )
    else:
        req_html += "<font color='#9ca3af'>None identified</font>"
    miss_html = f"<b>Missing Skills</b> &#160; <font color='#dc2626' size='8'>({len(missing_skills)} gaps)</font><br/><br/>"
    if missing_skills:
        miss_html += ", &#160; ".join(
            f"<font color='#dc2626'>{xml_escape(str(s).strip('*').strip())}</font>"
            for s in missing_skills
        )
    else:
        miss_html += "<font color='#059669'>All skills covered</font>"
    skills_row = Table(
        [
            [
                Paragraph(req_html, styles["Body"]),
                Paragraph(miss_html, styles["Body"]),
            ]
        ],
        colWidths=[col_half + 2 * mm, col_half + 2 * mm],
    )
    skills_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffffff")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#e2e8f0")),
        ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    content.append(skills_row)
    content.append(Spacer(1, 14))
    # ============================================================
    # AI Reasoning Sections (sequential, page-safe)
    # ============================================================
    # Executive Summary
    exec_summary = _extract_section_content(report.get("aiReasoning"), "Executive Summary")
    if exec_summary:
        summary_html = _section_to_html(exec_summary)
        content.extend(_make_panel(
            "Executive Summary",
            summary_html,
            styles,
            background="#f8fafc",
            border="#cbd5e1",
            accent="#475569",
        ))
        content.append(Spacer(1, 10))
    # Capacity vs Scope
    capacity_scope = _extract_labeled_bullet_table(
        report.get("aiReasoning"),
        "Capacity vs Scope Assessment",
        ["Area", "Assessment"],
    )
    if capacity_scope:
        _headers, rows = capacity_scope
        scope_html = ""
        for row in rows:
            area = _format_pdf_inline(row[0]) if row[0] else ""
            assessment = _format_pdf_inline(row[1]) if len(row) > 1 and row[1] else ""
            if area and assessment:
                scope_html += f"<b>{area}</b>: {assessment}<br/><br/>"
            elif area:
                scope_html += f"&bull; {area}<br/>"
        while scope_html.endswith("<br/>"):
            scope_html = scope_html[:-5]
        content.extend(_make_panel(
            "Capacity vs Scope",
            scope_html,
            styles,
            background="#f0fdf4",
            border="#bbf7d0",
            accent="#059669",
        ))
        content.append(Spacer(1, 10))
    # Skill Gap Analysis
    required_skills = report.get("requiredSkills", [])
    available_skills_list = report.get("availableSkills", [])
    missing_skills_list = report.get("missingSkills", [])
    if required_skills:
        req_names = ", ".join(str(s).strip("*").strip() for s in required_skills)
        covered_names = ", ".join(str(s).strip("*").strip().lower() for s in available_skills_list)
        covered_part = f" ({covered_names} covered by team)" if covered_names else ""
        gap_html = f"<b>Required Skills:</b> {xml_escape(req_names)}.<br/><br/>"
        gap_html += f"<b>Available Skills:</b> {len(available_skills_list)} identified.<br/><br/>"
        gap_html += f"<b>Missing Skills:</b> {len(missing_skills_list)} of {len(required_skills)} required skills{xml_escape(covered_part)} are missing.<br/><br/>"
        if missing_skills_list:
            gap_html += "<b>Impact:</b> The lack of skills will lead to delays, poor code quality, and potential project failure unless addressed immediately."
        content.extend(_make_panel(
            "Skill Gap Analysis",
            gap_html,
            styles,
            background="#fefce8",
            border="#fde68a",
            accent="#d97706",
        ))
        content.append(Spacer(1, 10))
    # Executive Action Plan
    action_plan = _extract_full_action_plan(report.get("aiReasoning"))
    if action_plan:
        action_html = _section_to_html(action_plan)
        content.extend(_make_panel(
            "Executive Action Plan",
            action_html,
            styles,
            background="#f0fdf4",
            border="#bbf7d0",
            accent="#059669",
        ))
        content.append(Spacer(1, 10))
    # ============================================================
    # Recommended Team Structure  (matches UI ReasoningSection bottom)
    # ============================================================
    team_structure_table = _extract_markdown_table(report.get("aiReasoning"), "Recommended Team Structure")
    if team_structure_table:
        ts_headers, ts_rows = team_structure_table
        content.append(PageBreak())
        content.extend(_make_table_block(
            "Recommended Team Structure",
            ts_headers,
            ts_rows,
            styles,
            background="#f0fdfa",
            border="#99f6e4",
            accent="#0d9488",
        ))
        content.append(Spacer(1, 10))
    # Footer
    content.append(Spacer(1, 8))
    content.append(Paragraph("Generated by AI Project Risk Intelligence System", styles["FooterText"]))
    doc.build(content)
    buffer.seek(0)
    # Include project name in the filename
    safe_name = re.sub(r"[^\w\s-]", "", project_name).strip().replace(" ", "_")[:50]
    pdf_filename = f"{safe_name}_Risk_Report.pdf" if safe_name else "Project_Risk_Report.pdf"
    return FileResponse(
        buffer,
        as_attachment=True,
        filename=pdf_filename,
    )
