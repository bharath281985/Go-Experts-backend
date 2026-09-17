import re

with open('src/common/helpers/crud-factory.ts', 'r', encoding='utf-8') as f:
    content = f.read()

search_startup = r'''      finalRows = rows.map\(\(r: any\) => \(\{
        \.\.\.r,
        founder: founderMap\[r\.founder\] \|\| r\.founder,
        industry: indMap\[r\.industry\] \|\| r\.industry,
        category: catMap\[r\.category\] \|\| r\.category,
        stage: stageMap\[r\.stage\] \|\| r\.stage,
      \}\)\);
    \}'''

replace_startup = r'''      finalRows = rows.map((r: any) => ({
        ...r,
        founder: founderMap[r.founder] || r.founder,
        industry: indMap[r.industry] || r.industry,
        category: catMap[r.category] || r.category,
        stage: stageMap[r.stage] || r.stage,
      }));
    } else if (String(mName) === "Investment") {
      const investorIds = Array.from(new Set(rows.map((r: any) => r.investor).filter(v => v && v.length > 20)));
      const investors = await prisma.user.findMany({ where: { id: { in: investorIds as string[] } }, select: { id: true, fullName: true, email: true } });
      const investorMap = Object.fromEntries(investors.map((c: any) => [c.id, c.fullName || c.email]));

      const startupIds = Array.from(new Set(rows.map((r: any) => r.startup).filter(v => v && v.length > 20)));
      const startups = await prisma.startupIdea.findMany({ where: { id: { in: startupIds as string[] } }, select: { id: true, startup: true } });
      const startupMap = Object.fromEntries(startups.map((c: any) => [c.id, c.startup]));

      finalRows = rows.map((r: any) => ({
        ...r,
        investor: investorMap[r.investor] || r.investor,
        startup: startupMap[r.startup] || r.startup,
      }));
    }'''

content = re.sub(search_startup, replace_startup, content)

with open('src/common/helpers/crud-factory.ts', 'w', encoding='utf-8') as f:
    f.write(content)
