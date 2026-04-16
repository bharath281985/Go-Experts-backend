const mongoose = require('mongoose');
const uri = 'mongodb+srv://saidineshgoexperts_db_user:r7lE5NYxGpb4GVTt@goexperts.ihc4tu2.mongodb.net/goexperts?retryWrites=true&w=majority';

mongoose.connect(uri).then(async () => {
    const Skill = mongoose.model('Skill', new mongoose.Schema({ name: String, category: mongoose.Schema.Types.Mixed }));
    const Category = mongoose.model('Category', new mongoose.Schema({ name: String }));

    const setupParent = async (catName, keywords) => {
        const cat = await Category.findOne({ name: catName });
        if (!cat) {
            console.log(`Category not found: ${catName}`);
            return;
        }
        const catId = cat._id.toString();
        const query = { $or: keywords.map(kw => ({ name: { $regex: kw, $options: 'i' } })) };
        const result = await Skill.updateMany(query, { $set: { category: catId } });
        console.log(`Assigned Core Skills to PARENT ${catName}:`, result);
    };

    const coreDevKeywords = ['React', 'Angular', 'Vue', 'Node', 'Express', 'MongoDB', 'JavaScript', 'TypeScript', 'Next.js', 'API', 'Firebase', 'AWS', 'HTML', 'CSS', 'Tailwind'];
    
    // Assign core dev skills to the PARENT category "Website Developers"
    await setupParent('Website Developers', coreDevKeywords);

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
