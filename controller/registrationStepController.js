const RegistrationStep = require('../models/RegistrationStep');

exports.getSteps = async (req, res) => {
    try {
        const { module } = req.query;
        let query = { isActive: true };
        if (module) query.module = module;
        const steps = await RegistrationStep.find(query).sort('order');
        res.status(200).json({ success: true, data: steps });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllStepsAdmin = async (req, res) => {
    try {
        const steps = await RegistrationStep.find().sort('order');
        res.status(200).json({ success: true, data: steps });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createStep = async (req, res) => {
    try {
        const step = await RegistrationStep.create(req.body);
        res.status(201).json({ success: true, data: step });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateStep = async (req, res) => {
    try {
        const step = await RegistrationStep.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!step) {
            return res.status(404).json({ success: false, message: 'Step not found' });
        }
        res.status(200).json({ success: true, data: step });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteStep = async (req, res) => {
    try {
        const step = await RegistrationStep.findByIdAndDelete(req.params.id);
        if (!step) {
            return res.status(404).json({ success: false, message: 'Step not found' });
        }
        res.status(200).json({ success: true, message: 'Step deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.reorderSteps = async (req, res) => {
    try {
        const { orderings } = req.body; // Array of { id, order }
        await Promise.all(orderings.map(item =>
            RegistrationStep.findByIdAndUpdate(item.id, { order: item.order })
        ));
        res.status(200).json({ success: true, message: 'Steps reordered' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
