const fs = require('fs');
const path = require('path');

const code = `
export const getClientContract = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const contractId = req.params.id;
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        project: {
          clientId: user.clientProfile?.id
        }
      },
      include: {
        project: true,
        freelancer: true,
        milestones: true,
      }
    });

    if (!contract) return res.status(404).json({ success: false, message: "Contract not found" });
    res.json({ success: true, contract });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getClientTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const taskId = req.params.id;
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
          clientId: user.clientProfile?.id
        }
      },
      include: {
        project: true,
        assignee: true,
      }
    });

    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, task });
  } catch (err) {
    handleError(err, res, next);
  }
};
`;

let content = fs.readFileSync('src/controllers/client/client.controller.ts', 'utf8');
if (!content.includes('getClientContract')) {
  content = content + '\n\n' + code;
  fs.writeFileSync('src/controllers/client/client.controller.ts', content);
}

let routes = fs.readFileSync('src/routes/client/client.routes.ts', 'utf8');
if (!routes.includes('getClientContract')) {
  routes = routes.replace('listClientContracts as any);', 'listClientContracts as any);\nrouter.get("/contracts/:id", getClientContract as any);');
  routes = routes.replace('listClientTasks as any);', 'listClientTasks as any);\nrouter.get("/tasks/:id", getClientTask as any);');
  
  routes = routes.replace('listClientContracts,', 'listClientContracts,\n  getClientContract,');
  routes = routes.replace('listClientTasks,', 'listClientTasks,\n  getClientTask,');
  
  fs.writeFileSync('src/routes/client/client.routes.ts', routes);
}
console.log('Added backend endpoints');
