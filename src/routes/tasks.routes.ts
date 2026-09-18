import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { 
  listTasks, 
  getTask, 
  createTask, 
  updateTask, 
  deleteTask 
} from '../controllers/tasks/tasks.controller.js';

const router = Router();

// All task routes require authentication
router.use(authMiddleware as any);

router.get('/', listTasks);
router.post('/', createTask);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
