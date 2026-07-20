export function parseCatalogListBody(body = {}) {
    const page = Number(body.page);
    const pageSize = Number(body.pageSize);
    return {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50,
        search: typeof body.search === "string" ? body.search.trim() || undefined : undefined,
    };
}
export function parseSkillsListBody(body = {}) {
    const base = parseCatalogListBody(body);
    const categoryId = (typeof body.categoryId === "string" && body.categoryId.trim()) ||
        (typeof body.industryId === "string" && body.industryId.trim()) ||
        undefined;
    return {
        ...base,
        categoryId,
        industryId: categoryId,
    };
}
export function parseFreelancersListBody(body = {}) {
    const base = parseCatalogListBody(body);
    const categoryId = (typeof body.categoryId === "string" && body.categoryId.trim()) ||
        (typeof body.industryId === "string" && body.industryId.trim()) ||
        undefined;
    const experience = Array.isArray(body.experience)
        ? body.experience.map(String).filter(Boolean)
        : undefined;
    const skills = Array.isArray(body.skills)
        ? body.skills.map(String).filter(Boolean)
        : undefined;
    const rateMin = Number(body.rateMin);
    const rateMax = Number(body.rateMax);
    return {
        ...base,
        categoryId,
        industryId: categoryId,
        experience: experience?.length ? experience : undefined,
        skills: skills?.length ? skills : undefined,
        rateMin: Number.isFinite(rateMin) ? rateMin : undefined,
        rateMax: Number.isFinite(rateMax) ? rateMax : undefined,
        orderBy: typeof body.orderBy === "string" ? body.orderBy : undefined,
        ascending: typeof body.ascending === "boolean" ? body.ascending : undefined,
    };
}
