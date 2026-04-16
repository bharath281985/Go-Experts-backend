const mongoose = require('mongoose');
const uri = 'mongodb+srv://saidineshgoexperts_db_user:r7lE5NYxGpb4GVTt@goexperts.ihc4tu2.mongodb.net/goexperts?retryWrites=true&w=majority';

mongoose.connect(uri).then(async () => {
    const Category = mongoose.model('Category', new mongoose.Schema({ name: String, parent: mongoose.Schema.Types.Mixed }));
    const catNames = ['Website Developers', 'Full-Stack Developers', 'Front-End Developers', 'Back-End Developers'];
    const cats = await Category.find({ name: { $in: catNames } });
    
    for (let cat of cats) {
        console.log(`${cat.name}: ID=${cat._id}, Parent=${cat.parent}`);
        if (cat.parent) {
            const parent = await Category.findById(cat.parent);
            console.log(`  Parent Name: ${parent ? parent.name : 'Unknown'}`);
        }
    }
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
