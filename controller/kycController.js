const KYC = require('../models/KYC');
const User = require('../models/User');

exports.getKYCStatus = async (req, res) => {
    try {
        const kyc = await KYC.findOne({ user: req.user.id });
        if (!kyc) {
            return res.status(200).json({ 
                success: true, 
                data: { status: 'unverified' } 
            });
        }
        res.status(200).json({ success: true, data: kyc });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.submitKYC = async (req, res) => {
    try {
        const { role } = req.body;
        let kyc = await KYC.findOne({ user: req.user.id });

        if (kyc && (kyc.status === 'pending' || kyc.status === 'fully_verified')) {
            return res.status(400).json({ 
                success: false, 
                message: 'KYC already submitted or verified.' 
            });
        }

        if (!kyc) {
            kyc = new KYC({ user: req.user.id, role });
        }

        // Helper to merge objects and strip empty strings
        const mergeData = (target, source) => {
            if (!source) return target;
            const cleanedSource = {};
            Object.keys(source).forEach(key => {
                const val = source[key];
                // Only merge non-blank values (unless they are booleans)
                if (val !== '' && val !== undefined && val !== null) {
                    cleanedSource[key] = val;
                }
            });
            return { ...target, ...cleanedSource };
        };

        // 🔹 Identity & ID Proof
        if (req.body.identity) kyc.identity = mergeData(kyc.identity?._doc || kyc.identity || {}, req.body.identity);
        if (req.body.id_proof) kyc.id_proof = mergeData(kyc.id_proof?._doc || kyc.id_proof || {}, req.body.id_proof);
        if (req.body.address_proof) kyc.address_proof = mergeData(kyc.address_proof?._doc || kyc.address_proof || {}, req.body.address_proof);

        // 🔹 Investor Specific
        if (role === 'investor' && req.body.financial_investor) {
            kyc.financial_investor = mergeData(kyc.financial_investor?._doc || kyc.financial_investor || {}, req.body.financial_investor);
        }

        // 🔹 Founder Specific
        if (role === 'startup_creator') {
            if (req.body.startup_details) kyc.startup_details = mergeData(kyc.startup_details?._doc || kyc.startup_details || {}, req.body.startup_details);
            if (req.body.business_verification) kyc.business_verification = mergeData(kyc.business_verification?._doc || kyc.business_verification || {}, req.body.business_verification);
        }

        // 🔹 Compliance
        if (req.body.compliance) kyc.compliance = mergeData(kyc.compliance?._doc || kyc.compliance || {}, req.body.compliance);

        kyc.status = 'pending';
        kyc.last_updated = Date.now();
        
        console.log('Final KYC for saving:', JSON.stringify(kyc, null, 2));
        await kyc.save();

        // Update User ref
        await User.findByIdAndUpdate(req.user.id, { 
            kyc: kyc._id,
            kyc_status: 'pending'
        });

        res.status(200).json({ success: true, data: kyc, message: 'KYC submitted successfully and is pending review.' });
    } catch (err) {
        console.error('SUBMIT KYC ERROR:', err.message, err.stack);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
};

// Admin Approve/Reject
exports.updateKYCStatus = async (req, res) => {
    try {
        const { status, remarks } = req.body;
        const kyc = await KYC.findById(req.params.id);
        
        if (!kyc) return res.status(404).json({ success: false, message: 'KYC not found' });

        kyc.status = status;
        kyc.admin_remarks = remarks;
        if (status === 'fully_verified' || status === 'premium_verified' || status.includes('verified')) {
            kyc.verified_at = Date.now();
        }
        await kyc.save();

        await User.findByIdAndUpdate(kyc.user, { kyc_status: status });

        res.status(200).json({ success: true, message: `KYC status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
