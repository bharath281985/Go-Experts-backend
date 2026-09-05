import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import {
  listTeamMembers,
  inviteTeamMember,
  updateTeamMemberPermissions,
  removeTeamMember
} from './team.controller.js';

const router = Router();

// All team endpoints require authentication
router.use(authenticate);

router.get('/', listTeamMembers);
router.post('/invite', inviteTeamMember);
router.patch('/:memberId/permissions', updateTeamMemberPermissions);
router.delete('/:memberId', removeTeamMember);

export default router;
