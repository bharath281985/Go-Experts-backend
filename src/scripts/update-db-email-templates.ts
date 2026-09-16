import { prisma } from '../config/database.js';

async function main() {
  const setting = await prisma.setting.findUnique({
    where: { key: 'settings:section:email_templates' }
  });

  if (!setting || !setting.value) {
    console.log('No email_templates setting found.');
    return;
  }

  let templates = [];
  try {
    templates = JSON.parse(setting.value);
  } catch (e) {
    console.error('Failed to parse email_templates', e);
    return;
  }

  let updated = false;

  for (let i = 0; i < templates.length; i++) {
    const tpl = templates[i];
    
    // Fix image paths in all templates
    if (tpl.html && tpl.html.includes('https://goexperts.in/assets/img/logo.png')) {
      tpl.html = tpl.html.replace(/https:\/\/goexperts\.in\/assets\/img\/logo\.png/g, 'https://goexperts.in/logo.png');
      updated = true;
    }

    // Add footer to tpl_verification_link if missing
    if (tpl.id === 'tpl_verification_link') {
      if (!tpl.html.includes('Go Experts &bull; Working With You. For You.')) {
        const searchStr = `</a></p>\n          </div>\n        </div>`;
        const replacement = `</a></p>\n          </div>\n          <div style="background-color: #fafbfc; padding: 24px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #edf2f7;">\n            <p style="margin: 0 0 6px 0; font-weight: 600; color: #4a5568;">Go Experts &bull; Working With You. For You.</p>\n            <p style="margin: 0;">Need support? Contact us anytime at <a href="mailto:servicedesk@goexperts.in" style="color: #E30613; text-decoration: none;">servicedesk@goexperts.in</a></p>\n          </div>\n        </div>`;
        
        if (tpl.html.includes(searchStr)) {
          tpl.html = tpl.html.replace(searchStr, replacement);
          updated = true;
        }
      }
    }
  }

  if (updated) {
    await prisma.setting.update({
      where: { key: 'settings:section:email_templates' },
      data: { value: JSON.stringify(templates) }
    });
    console.log('Successfully updated email_templates in DB');
  } else {
    console.log('No updates were necessary or pattern not found.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
