import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// External actors (sección 4 del alcance). Sandbox adapters with deterministic rules so every
// path can be exercised; swap each class for the real provider's SDK in production.

@Injectable()
export class KycProvider {
  private log = new Logger('KycProvider');

  // Documents ending in "000" go to manual review; a biometric score under 0.6 is rejected.
  // The sandbox decides the score itself: documents ending in "999" simulate a failed selfie match.
  verify(input: { docNumber: string }) {
    const ref = `KYC-${randomUUID().slice(0, 8)}`;
    const digits = input.docNumber.replace(/\D/g, '');
    const score = digits.endsWith('999') ? 0.42 : 0.93;
    const status = digits.endsWith('000')
      ? ('MANUAL_REVIEW' as const)
      : score < 0.6
        ? ('REJECTED' as const)
        : ('APPROVED' as const);
    this.log.log(`verify ${input.docNumber} -> ${status}`);
    return { ref, score, status };
  }
}

@Injectable()
export class FundingProvider {
  private log = new Logger('FundingProvider');

  // Aliado de fondeo: reserves the liquidity that finances a disbursement.
  reserve(amount: number) {
    return { ok: amount > 0, ref: `FND-${randomUUID().slice(0, 8)}` };
  }

  // Frees a reservation whose disbursement did not go out.
  release(ref: string) {
    this.log.log(`release ${ref}`);
    return { ok: true };
  }
}

@Injectable()
export class PaymentsProvider {
  private log = new Logger('PaymentsProvider');

  // Accounts ending in "0000" simulate a transfer rejected by the destination bank.
  transfer(input: { bank: string; account: string; amount: number }) {
    const ok = !input.account.replace(/\D/g, '').endsWith('0000');
    this.log.log(`transfer ${input.amount} to ${input.bank} ${input.account} -> ${ok ? 'OK' : 'FAILED'}`);
    return ok
      ? { ok: true as const, ref: `PAY-${randomUUID().slice(0, 8)}` }
      : { ok: false as const, error: 'La entidad destino rechazó la transferencia' };
  }
}
