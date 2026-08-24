import { Request, Response } from 'express';
import { verifyEasebuzzReverseHash } from '../../modules/mobile/payments/gateways/easebuzz.gateway.js';
import { completePaymentFromWebhook } from '../../modules/mobile/payments/payments.service.js';

export const webEasebuzzReturn = async (req: Request, res: Response) => {
  try {
    const { txnid, amount, status, hash, email, firstname, productinfo } = req.body;
    const valid = verifyEasebuzzReverseHash(
      String(txnid || ''),
      String(amount || ''),
      String(status || ''),
      String(hash || ''),
      String(email || ''),
      String(firstname || ''),
      String(productinfo || '')
    );
    
    if (valid && String(status).toLowerCase() === 'success') {
      await completePaymentFromWebhook(String(txnid), String(productinfo || ''));
      return res.redirect('http://localhost:5175/pricing?payment=success');
    }
    
    return res.redirect('http://localhost:5175/pricing?payment=failure');
  } catch (err) {
    console.error('Easebuzz web return error:', err);
    return res.redirect('http://localhost:5175/pricing?payment=error');
  }
};
