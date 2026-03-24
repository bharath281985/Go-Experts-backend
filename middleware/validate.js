const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        console.error('Validation Error:', error);

        let errorMessage = 'Validation failed';
        let errors = [];

        if (error.errors && error.errors.length > 0) {
            errorMessage = error.errors[0].message;
            errors = error.errors.map(err => ({
                path: err.path.join('.'),
                message: err.message
            }));
        } else if (error.message) {
            errorMessage = error.message;
        }

        return res.status(400).json({
            success: false,
            message: errorMessage,
            errors
        });
    }
};

module.exports = validate;
