import re

with open('src/common/helpers/crud-factory.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. We will insert our applyCustomMappings function right after formatRecord
search_helper = r'  // Helper to format generic master records with description, code, and slug.*?  \};'

replace_helper = r'''  // Helper to format generic master records with description, code, and slug
  const formatRecord = (row: any) => {
    if (!row) return row;
    const label = row.label || row.name || row.title || row.value || "Reference Item";
    const slugVal = row.slug || row.code || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const codeVal = row.code || row.referenceCode || row.value || label.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    const descVal = row.description || `Platform reference catalog configuration option for ${label}.`;

    return {
      ...row,
      name: row.name || label,
      label: row.label || label,
      description: descVal,
      code: codeVal,
      referenceCode: codeVal,
      slug: slugVal,
    };
  };

  const applyCustomMappings = async (mName: string, rows: any[]) => {
    if (rows.length === 0) return rows;
    let finalRows = [...rows];

    if (String(mName).toLowerCase() === "project") {
      const clientIds = [...new Set(rows.map((r: any) => r.client).filter(Boolean))];
      const clients = await prisma.user.findMany({ where: { id: { in: clientIds as string[] } }, select: { id: true, fullName: true } });
      const clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c.fullName]));
      
      const catIds = [...new Set(rows.map((r: any) => r.category).filter(Boolean))];
      const cats = await prisma.skillCategory.findMany({ where: { id: { in: catIds as string[] } }, select: { id: true, name: true } });
      const catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));
      
      const techIds = [...new Set(rows.flatMap((r: any) => (r.technology || "").split(",")).filter(Boolean))];
      const techs = await prisma.skill.findMany({ where: { id: { in: techIds as string[] } }, select: { id: true, name: true } });
      const techMap = Object.fromEntries(techs.map((c: any) => [c.id, c.name]));
      
      const moIds = [...new Set(rows.flatMap((r: any) => [r.budgetRangeId, r.workMode]).filter(Boolean))];
      const mos = await prisma.masterOption.findMany({ where: { id: { in: moIds as string[] } }, select: { id: true, label: true } });
      const moMap = Object.fromEntries(mos.map((m: any) => [m.id, m.label]));

      const mapExp = (slug: string) => slug === "mo_experience_level_intermediate" ? "Intermediate" : 
                                       slug === "mo_experience_level_expert" ? "Expert" : 
                                       slug === "mo_experience_level_entry" ? "Entry Level" : slug;

      finalRows = rows.map((r: any) => ({
        ...r,
        client: clientMap[r.client] || r.client,
        category: catMap[r.category] || r.category,
        technology: (r.technology || "").split(",").map((id: string) => techMap[id] || id).join(", "),
        budgetRangeId: moMap[r.budgetRangeId] || r.budgetRangeId,
        workMode: moMap[r.workMode] || r.workMode,
        experienceLevel: r.experienceLevel ? mapExp(r.experienceLevel) : r.experienceLevel
      }));
    } else if (String(mName) === "StartupIdea") {
      const founderIds = [...new Set(rows.map((r: any) => r.founder).filter(v => v && v.length > 20))];
      const founders = await prisma.user.findMany({ where: { id: { in: founderIds as string[] } }, select: { id: true, fullName: true, email: true } });
      const founderMap = Object.fromEntries(founders.map((c: any) => [c.id, c.fullName || c.email]));

      const indIds = [...new Set(rows.map((r: any) => r.industry).filter(v => v && v.length > 20))];
      const inds = await prisma.industry.findMany({ where: { id: { in: indIds as string[] } }, select: { id: true, name: true } });
      const indMap = Object.fromEntries(inds.map((c: any) => [c.id, c.name]));

      const catIds = [...new Set(rows.map((r: any) => r.category).filter(v => v && v.length > 20))];
      const cats = await prisma.skillCategory.findMany({ where: { id: { in: catIds as string[] } }, select: { id: true, name: true } });
      const catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));

      const stageIds = [...new Set(rows.map((r: any) => r.stage).filter(v => v && v.length > 20))];
      const stages = await prisma.startupStage.findMany({ where: { id: { in: stageIds as string[] } }, select: { id: true, name: true } });
      const stageMap = Object.fromEntries(stages.map((c: any) => [c.id, c.name]));

      finalRows = rows.map((r: any) => ({
        ...r,
        founder: founderMap[r.founder] || r.founder,
        industry: indMap[r.industry] || r.industry,
        category: catMap[r.category] || r.category,
        stage: stageMap[r.stage] || r.stage,
      }));
    }

    return finalRows;
  };'''

content = re.sub(search_helper, replace_helper, content, flags=re.DOTALL)

# 2. Now replace the inline Project block in GET /
search_get = r'let finalRows = rows;.*?res\.json\(\{ success: true, rows: finalRows\.map\(formatRecord\), total \}\);'
replace_get = r'''const finalRows = await applyCustomMappings(String(modelName), rows);
      res.json({ success: true, rows: finalRows.map(formatRecord), total });'''
content = re.sub(search_get, replace_get, content, flags=re.DOTALL)

# 3. Apply custom mappings to POST /list
search_post = r'res\.json\(\{ success: true, rows: rows\.map\(formatRecord\), total \}\);'
replace_post = r'''const finalRows = await applyCustomMappings(String(modelName), rows);
      res.json({ success: true, rows: finalRows.map(formatRecord), total });'''
content = re.sub(search_post, replace_post, content, count=1)  # Only first occurrence in /list

# 4. Apply custom mappings to GET /export
search_export = r'res\.json\(\{ success: true, rows: rows\.map\(formatRecord\) \}\);'
replace_export = r'''const finalRows = await applyCustomMappings(String(modelName), rows);
      res.json({ success: true, rows: finalRows.map(formatRecord) });'''
content = re.sub(search_export, replace_export, content)

with open('src/common/helpers/crud-factory.ts', 'w', encoding='utf-8') as f:
    f.write(content)
