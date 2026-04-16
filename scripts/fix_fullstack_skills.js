const mongoose = require('mongoose');
const uri = 'mongodb+srv://saidineshgoexperts_db_user:r7lE5NYxGpb4GVTt@goexperts.ihc4tu2.mongodb.net/goexperts?retryWrites=true&w=majority';

mongoose.connect(uri).then(async () => {
    const Skill = mongoose.model('Skill', new mongoose.Schema({ name: String, category: mongoose.Schema.Types.Mixed }));
    const Category = mongoose.model('Category', new mongoose.Schema({ name: String }));

    const cat = await Category.findOne({ name: 'Full-Stack Developers' });
    if (!cat) {
        console.log('Category not found');
        process.exit();
    }
    const catId = cat._id.toString();
    console.log('Category found:', catId);

    const keywords = [
        'React', 'Angular', 'Vue', 'Node', 'Express', 'MongoDB', 
        'JavaScript', 'TypeScript', 'Firebase', 'Socket.IO', 'AWS', 
        'API', 'Backend', 'Frontend', 'Next.js'
    ];

    const query = {
        $or: keywords.map(kw => ({ name: { $regex: kw, $options: 'i' } }))
    };

    const result = await Skill.updateMany(
        query,
        { $set: { category: catId } }
    );

    console.log('Update result:', result);
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
