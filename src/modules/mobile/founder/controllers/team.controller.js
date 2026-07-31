import { successResponse } from '../../../../core/response.js';
export const getTeam = async (req, res, next) => {
    try {
        return res.json(successResponse('Team members retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const inviteTeamMember = async (req, res, next) => {
    try {
        return res.status(201).json(successResponse('Team member invited', req.body));
    }
    catch (error) {
        next(error);
    }
};
export const updateTeamMember = async (req, res, next) => {
    try {
        return res.json(successResponse('Team member updated', { id: req.params.id, ...req.body }));
    }
    catch (error) {
        next(error);
    }
};
export const removeTeamMember = async (req, res, next) => {
    try {
        return res.json(successResponse('Team member removed'));
    }
    catch (error) {
        next(error);
    }
};
