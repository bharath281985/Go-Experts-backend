import { ZodError } from "zod";
export const validate = (schema) => {
    return async (req, res, next) => {
        try {
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            // Replace req objects with validated/typed ones
            req.body = parsed.body;
            req.query = parsed.query;
            req.params = parsed.params;
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    details: error.errors.map(e => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                });
            }
            next(error);
        }
    };
};
