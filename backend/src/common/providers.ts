import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// External actors (sección 4 del alcance). Sandbox adapters with deterministic rules so every
// path can be exercised; swap each class for the real provider's SDK in production.

@Injectable()
export class KycProvider {
  private log = new Logger('KycProvider');

  // Documents ending in "000" go to manual review; a biometric score under 0.6 is rejected.
  verify(input: { docNumber: string; selfieScore?: number }) {
    const ref = `KYC-${randomUUID().slice(0, 8)}`;
    const score = input.selfieScore ?? 0.93;
    const status = input.docNumber.replace(/\D/g, '').endsWith('000')
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
  // Aliado de fondeo: reserves the liquidity that finances a disbursement.
  reserve(amount: number) {
    return { ok: amount > 0, ref: `FND-${randomUUID().slice(0, 8)}` };
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
