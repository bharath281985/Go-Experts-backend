const User = require('../../../models/User');
const KYC = require('../../../models/KYC');

const getPrimaryRole = (user) => (
    Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles.find((role) => role !== 'admin') || user.roles[0]
        : 'freelancer'
);

const parseMaybeJson = (value) => {
    if (!value || typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return value;
    }
};

const mergeData = (target = {}, source = {}) => {
    const parsedSource = parseMaybeJson(source) || {};
    if (typeof parsedSource !== 'object' || Array.isArray(parsedSource)) return target;

    const cleanedSource = {};
    Object.keys(parsedSource).forEach((key) => {
        const value = parsedSource[key];
        if (value !== '' && value !== undefined && value !== null) {
            cleanedSource[key] = value;
        }
    });

    return { ...(target || {}), ...cleanedSource };
};

const buildKycResponse = (user, kyc) => {
    const status = user.kyc_details?.is_verified && user.kyc_status !== 'premium_verified'
        ? 'fully_verified'
        : (user.kyc_status || kyc?.status || 'unverified');

    return {
        status,
        is_verified_by_admin: ['basic_verified', 'fully_verified', 'premium_verified'].includes(status) || !!user.kyc_details?.is_verified,
        is_pending_review: status === 'pending',
        is_rejected: status === 'rejected',
        admin_remarks: kyc?.admin_remarks || '',
        verified_at: user.kyc_details?.verified_at || kyc?.verified_at || null,
        kyc_details: {
            pan_card: user.kyc_details?.pan_card || kyc?.id_proof?.pan_card || '',
            aadhar_card: user.kyc_details?.aadhar_card || kyc?.id_proof?.aadhar_card || '',
            is_verified: !!user.kyc_details?.is_verified
        },
        documents: {
            educational: user.documents?.educational || [],
            experience_letter: user.documents?.experience_letter || ''
        },
        kyc: kyc || null
    };
};

const filePath = (file) => file ? `/uploads/kyc/${file.filename}` : undefined;

/**
 * @desc    Get mobile user's verification/KYC details
 * @route   GET /api/mobile/user/kyc
 * @access  Private
 */
exports.getMobileKYC = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('roles kyc_status kyc_details documents');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const kyc = await KYC.findOne({ user: req.user.id }).lean();

        res.status(200).json({
            success: true,
            data: buildKycResponse(user, kyc)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Submit/update mobile user's verification/KYC details
 * @route   PUT /api/mobile/user/kyc
 * @access  Private
 */
exports.updateMobileKYC = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const role = req.body.role || getPrimaryRole(user);
        let kyc = await KYC.findOne({ user: req.user.id });
        if (!kyc) {
            kyc = new KYC({ user: req.user.id, role });
        }

        kyc.role = role;
        kyc.identity = mergeData(kyc.identity?._doc || kyc.identity, req.body.identity);
        kyc.id_proof = mergeData(kyc.id_proof?._doc || kyc.id_proof, req.body.id_proof);
        kyc.address_proof = mergeData(kyc.address_proof?._doc || kyc.address_proof, req.body.address_proof);
        kyc.financial_investor = mergeData(kyc.financial_investor?._doc || kyc.financial_investor, req.body.financial_investor);
        kyc.startup_details = mergeData(kyc.startup_details?._doc || kyc.startup_details, req.body.startup_details);
        kyc.business_verification = mergeData(kyc.business_verification?._doc || kyc.business_verification, req.body.business_verification);
        kyc.compliance = mergeData(kyc.compliance?._doc || kyc.compliance, req.body.compliance);

        const files = req.files || {};
        const firstFile = (field) => Array.isArray(files[field]) ? files[field][0] : null;
        const allFiles = (field) => Array.isArray(files[field]) ? files[field].map(filePath).filter(Boolean) : [];

        if (firstFile('profile_photo')) kyc.set('identity.profile_photo', filePath(firstFile('profile_photo')));
        if (firstFile('pan_card')) {
            const path = filePath(firstFile('pan_card'));
            kyc.set('id_proof.pan_card', path);
            user.set('kyc_details.pan_card', path);
        }
        if (firstFile('aadhar_card')) {
            const path = filePath(firstFile('aadhar_card'));
            kyc.set('id_proof.aadhar_card', path);
            user.set('kyc_details.aadhar_card', path);
        }
        if (firstFile('passport')) kyc.set('id_proof.passport', filePath(firstFile('passport')));
        if (firstFile('driving_license')) kyc.set('id_proof.driving_license', filePath(firstFile('driving_license')));
        if (firstFile('address_proof')) kyc.set('address_proof.document_url', filePath(firstFile('address_proof')));
        if (firstFile('cancelled_cheque')) kyc.set('financial_investor.bank_details.cancelled_cheque', filePath(firstFile('cancelled_cheque')));
        if (firstFile('pitch_deck')) kyc.set('startup_details.pitch_deck', filePath(firstFile('pitch_deck')));
        if (firstFile('business_plan')) kyc.set('startup_details.business_plan', filePath(firstFile('business_plan')));
        if (firstFile('financial_projections')) kyc.set('startup_details.financial_projections', filePath(firstFile('financial_projections')));
        if (allFiles('demo_screenshots').length) kyc.set('startup_details.demo_screenshots', allFiles('demo_screenshots'));
        if (firstFile('inc_certificate')) kyc.set('business_verification.inc_certificate', filePath(firstFile('inc_certificate')));
        if (firstFile('gst_certificate')) kyc.set('business_verification.gst_certificate', filePath(firstFile('gst_certificate')));
        if (firstFile('company_pan')) kyc.set('business_verification.company_pan', filePath(firstFile('company_pan')));
        if (firstFile('startup_india_cert')) kyc.set('business_verification.startup_india_cert', filePath(firstFile('startup_india_cert')));
        if (firstFile('digital_signature')) kyc.set('compliance.digital_signature', filePath(firstFile('digital_signature')));
        
        const academicFiles = [
            ...(Array.isArray(files.academic_certificates) ? files.academic_certificates : []),
            ...(Array.isArray(files.educational) ? files.educational : [])
        ];
        if (academicFiles.length) {
            user.set('documents.educational', academicFiles.map((file) => `/uploads/documents/${file.filename}`));
        }
        if (Array.isArray(files.experience_letter) && files.experience_letter[0]) {
            user.set('documents.experience_letter', `/uploads/documents/${files.experience_letter[0].filename}`);
        }

        kyc.status = 'pending';
        kyc.last_updated = Date.now();
        kyc.admin_remarks = '';
        await kyc.save();

        user.kyc_status = 'pending';
        if (!user.kyc_details) user.kyc_details = {};
        user.kyc_details.is_verified = false;
        user.markModified('kyc_details');
        await user.save();

        res.status(200).json({
            success: true,
            message: 'KYC details submitted successfully and pending admin verification.',
            data: buildKycResponse(user, kyc.toObject())
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
