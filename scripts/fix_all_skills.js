const mongoose = require('mongoose');
const uri = 'mongodb+srv://saidineshgoexperts_db_user:r7lE5NYxGpb4GVTt@goexperts.ihc4tu2.mongodb.net/goexperts?retryWrites=true&w=majority';

mongoose.connect(uri).then(async () => {
    const Skill = mongoose.model('Skill', new mongoose.Schema({ name: String, category: mongoose.Schema.Types.Mixed }));
    const Category = mongoose.model('Category', new mongoose.Schema({ name: String }));

    const setupCategory = async (catName, keywords) => {
        const cat = await Category.findOne({ name: catName });
        if (!cat) {
            console.log(`Category not found: ${catName}`);
            return;
        }
        const catId = cat._id.toString();
        const query = { $or: keywords.map(kw => ({ name: { $regex: kw, $options: 'i' } })) };
        
        // Find skills that match keywords but DON'T necessarily have this category yet
        const skillsCount = await Skill.countDocuments(query);
        console.log(`Found ${skillsCount} potential skills for ${catName} using keywords: ${keywords.join(', ')}`);
        
        const result = await Skill.updateMany(query, { $set: { category: catId } });
        console.log(`Updated ${catName}:`, result);
    };

    // Generic Dev Keywords
    const devKeywords = ['React', 'Angular', 'Vue', 'Node', 'Express', 'MongoDB', 'JavaScript', 'TypeScript', 'Next.js', 'API', 'Firebase', 'AWS', 'Docker', 'Git', 'HTML', 'CSS', 'PostgreSQL'];

    // Update all variations of Web Developers
    await setupCategory('Website Developers', devKeywords);
    await setupCategory('Full-Stack Developers', devKeywords);
    await setupCategory('Front-End Developers', ['React', 'Angular', 'Vue', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Next.js', 'Tailwind']);
    await setupCategory('Back-End Developers', ['Node', 'Express', 'MongoDB', 'PostgreSQL', 'API', 'Docker', 'AWS', 'Python', 'Django', 'Spring Boot']);
    await setupCategory('Custom Websites', devKeywords);
    await setupCategory('E-Commerce Website Development', ['Shopify', 'React', 'Next.js', 'Payments', 'Cart', 'Node', 'API']);
    
    // Update Design Categories
    await setupCategory('Website Designers', ['Figma', 'Sketch', 'UI/UX', 'Wireframe', 'Adobe XD', 'Prototyping']);
    await setupCategory('Logo Design', ['Illustrator', 'Logo', 'Branding', 'Vector']);

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
