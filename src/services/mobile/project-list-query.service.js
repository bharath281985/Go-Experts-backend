"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProjectListQuery = exports.parsePagination = void 0;
const asString = (value) => {
    if (value == null)
        return undefined;
    if (Array.isArray(value))
        return asString(value[0]);
    const text = String(value).trim();
    return text.length ? text : undefined;
};
const asStringList = (value) => {
    if (value == null)
        return [];
    if (Array.isArray(value)) {
        return value.flatMap((item) => asStringList(item));
    }
    return String(value)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
};
const readParam = (req, ...keys) => {
    for (const key of keys) {
        if (req.query[key] != null)
            return req.query[key];
        const body = req.body;
        if (body && body[key] != null)
            return body[key];
    }
    return undefined;
};
const parsePagination = (req) => {
    const page = Math.max(1, parseInt(String(readParam(req, 'page') ?? '1'), 10) || 1);
    const rawLimit = parseInt(String(readParam(req, 'pageSize', 'page_size', 'limit') ?? '20'), 10);
    const limit = Math.min(Math.max(1, rawLimit || 20), 100);
    return { page, limit, skip: (page - 1) * limit };
};
exports.parsePagination = parsePagination;
const parseProjectListQuery = (req, scope) => {
    const { page, limit, skip } = (0, exports.parsePagination)(req);
    const q = asString(readParam(req, 'q', 'search'));
    const status = asString(readParam(req, 'status'));
    const workModes = asStringList(readParam(req, 'workMode', 'workModes', 'work_mode'));
    const experienceLevels = asStringList(readParam(req, 'experienceLevel', 'experienceLevels', 'experience_level'));
    const categories = [
        ...asStringList(readParam(req, 'category', 'categories')),
        ...asStringList(readParam(req, 'categoryId', 'categoryIds', 'category_id')),
    ];
    const sortRaw = (asString(readParam(req, 'sort', 'sort_by', 'sortBy')) || 'newest').toLowerCase();
    const where = { deletedAt: null };
    if (scope.kind === 'public' || scope.kind === 'freelancer_browse') {
        where.status = 'open';
    }
    else if (scope.kind === 'client') {
        where.client = scope.clientId;
        if (status)
            where.status = status;
    }
    else if (scope.kind === 'freelancer_assigned') {
        where.freelancer = scope.freelancerId;
        if (status)
            where.status = status;
    }
    if (q) {
        where.OR = [
            { title: { contains: q } },
            { technology: { contains: q } },
            { description: { contains: q } },
        ];
    }
    if (categories.length === 1) {
        where.category = categories[0];
    }
    else if (categories.length > 1) {
        where.category = { in: categories };
    }
    if (workModes.length === 1) {
        where.workMode = workModes[0];
    }
    else if (workModes.length > 1) {
        where.workMode = { in: workModes };
    }
    if (experienceLevels.length === 1) {
        where.experienceLevel = experienceLevels[0];
    }
    else if (experienceLevels.length > 1) {
        where.experienceLevel = { in: experienceLevels };
    }
    let orderBy = { createdAt: 'desc' };
    if (sortRaw.includes('budget') &&
        (sortRaw.includes('low') || sortRaw.includes('asc') || sortRaw === 'budget_asc')) {
        orderBy = [{ budget: 'asc' }, { createdAt: 'desc' }];
    }
    else if (sortRaw.includes('budget') &&
        (sortRaw.includes('high') || sortRaw.includes('desc') || sortRaw === 'budget_desc')) {
        orderBy = [{ budget: 'desc' }, { createdAt: 'desc' }];
    }
    else if (sortRaw.includes('proposal')) {
        orderBy = [{ proposals: { _count: 'desc' } }, { createdAt: 'desc' }];
    }
    else if (sortRaw.includes('oldest') || sortRaw === 'created_asc') {
        orderBy = { createdAt: 'asc' };
    }
    else {
        orderBy = { createdAt: 'desc' };
    }
    return { where, orderBy, page, limit, skip };
};
exports.parseProjectListQuery = parseProjectListQuery;
