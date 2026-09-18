import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  const invoiceHtml = `
<div style="font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif; color: #555; background-color: #fff; max-width: 800px; margin: auto; padding: 40px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; line-height: 24px;">
    <table cellpadding="0" cellspacing="0" style="width: 100%; line-height: inherit; text-align: left;">
        <tr>
            <td colspan="2" style="padding-bottom: 20px;">
                <table style="width: 100%; line-height: inherit; text-align: left;">
                    <tr>
                        <td class="title" style="font-size: 36px; line-height: 45px; color: #333; font-weight: bold;">
                            GoExperts<span style="color: #2563eb;">.</span>
                        </td>
                        <td style="text-align: right; padding-bottom: 20px;">
                            <strong style="color:#000;">Invoice #:</strong> {{invoiceNumber}}<br>
                            <strong style="color:#000;">Created:</strong> {{invoiceDate}}<br>
                            <strong style="color:#000;">Due:</strong> {{dueDate}}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td colspan="2">
                <table style="width: 100%; line-height: inherit; text-align: left; padding-bottom: 40px;">
                    <tr>
                        <td style="padding-bottom: 20px;">
                            <h3 style="margin-top:0; color:#333; font-size: 18px;">Company Information</h3>
                            <strong>Go Experts</strong><br>
                            123 Tech Avenue<br>
                            San Francisco, CA 94107<br>
                            support@goexperts.in
                        </td>
                        <td style="text-align: right; padding-bottom: 20px;">
                            <h3 style="margin-top:0; color:#333; font-size: 18px;">Bill To</h3>
                            <strong>{{userName}}</strong><br>
                            {{userCompany}}<br>
                            {{userAddress}}<br>
                            {{userEmail}}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr class="heading" style="background: #eee; border-bottom: 1px solid #ddd; font-weight: bold;">
            <td style="padding: 10px;">Item / Description</td>
            <td style="padding: 10px; text-align: right;">Amount</td>
        </tr>
        
        <!-- START ITEMS LOOP (Replace with actual backend loop or leave placeholder for CKEditor) -->
        {{items}}
        <!-- END ITEMS LOOP -->
        
        <tr class="total" style="border-top: 2px solid #eee; font-weight: bold; font-size: 18px; color: #333;">
            <td style="padding-top: 20px;"></td>
            <td style="padding-top: 20px; text-align: right;">Total: {{totalAmount}}</td>
        </tr>
    </table>
    
    <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
        <p>Thank you for your business. Please make payment within 14 days of receiving this invoice.</p>
        <p>If you have any questions concerning this invoice, contact our support team at support@goexperts.in.</p>
    </div>
</div>
`;

  try {
    const existing = await prisma.cmsPage.findUnique({
      where: { name: 'Invoice Template' }
    });

    if (existing) {
      console.log('Invoice Template already exists. Updating...');
      await prisma.cmsPage.update({
        where: { name: 'Invoice Template' },
        data: {
          content: invoiceHtml,
          publishedJson: JSON.stringify({ html: invoiceHtml })
        }
      });
    } else {
      console.log('Creating Invoice Template...');
      await prisma.cmsPage.create({
        data: {
          name: 'Invoice Template',
          category: 'system',
          status: 'active',
          content: invoiceHtml,
          publishedJson: JSON.stringify({ html: invoiceHtml }),
          items: 1,
        }
      });
    }

    console.log('Invoice Template seeded successfully.');
  } catch (error) {
    console.error('Error seeding Invoice Template:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
